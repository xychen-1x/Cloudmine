import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {validateLimits,LIMITS} from "../src/lib/ai/limits";
import {runProviderChain} from "../src/lib/ai/orchestrator";
import {redactCoordinates,sanitizeUserText} from "../src/lib/ai/sanitize";
import {buildAIRequest} from "../src/lib/ai/prompts";
import type {AIProvider,AIRequest} from "../src/lib/ai/types";
const req:AIRequest={systemPrompt:"system",userPrompt:"question"};
const success=(name:"gemini"|"groq",text="Clear skies.")=>({ok:true as const,value:{text,model:name==="gemini"?"gemini-3.1-flash-lite":"openai/gpt-oss-20b",finishReason:"stop" as const}});
const provider=(name:"gemini"|"groq",generate:AIProvider["generate"]):AIProvider=>({name,generate});
describe("limits",()=>{
 it("accepts defaults and a valid lower-bound fixture",()=>{expect(validateLimits(LIMITS)).toEqual([]);expect(validateLimits({totalBudgetMs:2,primaryTimeoutMs:1,fallbackTimeoutMs:1,minFallbackMs:1,minAttemptMs:1})).toEqual([]);});
 it("rejects invalid and cross-field values",()=>{expect(validateLimits({...LIMITS,totalBudgetMs:2**31})).toContain("totalBudgetMs");expect(validateLimits({...LIMITS,minFallbackMs:100})).toContain("minFallbackMs");expect(validateLimits({...LIMITS,totalBudgetMs:100})).toContain("totalBudgetMs");});
});
describe("provider orchestration",()=>{
 it("turns thrown exceptions into generic unknown without fallback",async()=>{const fallback=vi.fn(async()=>success("groq"));const primary=provider("gemini",async()=>{throw new Error("secret prompt and key");});const result=await runProviderChain(req,[primary,provider("groq",fallback)]);expect(result).toMatchObject({ok:false,error:{code:"unknown",message:"Unexpected provider failure."}});expect(fallback).not.toHaveBeenCalled();});
 it("handles rejected non-Error values without leaking details",async()=>{const result=await runProviderChain(req,[provider("gemini",()=>Promise.reject({message:"sensitive"}))]);expect(result).toMatchObject({ok:false,error:{code:"unknown"}});expect(JSON.stringify(result)).not.toContain("sensitive");});
 it("discards late primary success and calls fallback with a fresh signal",async()=>{const primary=provider("gemini",async(_input,signal)=>new Promise(resolve=>signal.addEventListener("abort",()=>setTimeout(()=>resolve(success("gemini")),5),{once:true})));let fallbackSignal:AbortSignal|undefined;const secondary=provider("groq",async(_input,signal)=>{fallbackSignal=signal;return success("groq");});const result=await runProviderChain(req,[primary,secondary],undefined,{totalBudgetMs:1000,primaryTimeoutMs:20,fallbackTimeoutMs:100,minFallbackMs:100,minAttemptMs:5});expect(result).toMatchObject({ok:true,value:{model:"openai/gpt-oss-20b"}});expect(fallbackSignal?.aborted).toBe(false);});
 it("does not invoke provider for invalid limits",async()=>{const call=vi.fn(async()=>success("gemini"));const result=await runProviderChain(req,[provider("gemini",call)],undefined,{...LIMITS,totalBudgetMs:0});expect(result).toMatchObject({ok:false,error:{code:"invalid_argument"}});expect(call).not.toHaveBeenCalled();});
 it("falls back after a primary rate limit",async()=>{const primary=provider("gemini",async()=>({ok:false as const,error:{code:"rate_limited" as const,retryable:true,provider:"gemini" as const,message:"rate limited"}}));const secondary=provider("groq",async()=>success("groq"));const result=await runProviderChain(req,[primary,secondary]);expect(result).toMatchObject({ok:true,value:{provider:"groq"}});});
 it("does not fall back after an authentication failure",async()=>{const fallback=vi.fn(async()=>success("groq"));const primary=provider("gemini",async()=>({ok:false as const,error:{code:"auth" as const,retryable:false,provider:"gemini" as const,message:"auth"}}));const result=await runProviderChain(req,[primary,provider("groq",fallback)]);expect(result).toMatchObject({ok:false,error:{code:"auth"}});expect(fallback).not.toHaveBeenCalled();});
 it("gives caller cancellation precedence over a provider success",async()=>{const controller=new AbortController();const primary=provider("gemini",async()=>{controller.abort();return success("gemini");});const result=await runProviderChain(req,[primary],controller.signal);expect(result).toMatchObject({ok:false,error:{code:"aborted"}});});
});
describe("privacy helpers",()=>{
 it("redacts decimal coordinate pairs and geo URIs",()=>{expect(redactCoordinates("Here 14.5995, 120.9842 and geo:14.5,120.9")).not.toContain("14.5995");});
 it("trims and caps user text",()=>{expect(sanitizeUserText("  hello  ")).toBe("hello");expect(sanitizeUserText("x".repeat(1200))).toHaveLength(1000);});
 it("allowlists nested weather values at runtime and drops injected coordinate fields",()=>{
  const hostile={kind:"weather-data",source:"open-meteo",fetchedAt:"2026-11-24T00:00:00Z",locationLabel:"Manila",
   current:{temperatureC:30,latitude:14.5,longitude:120.9,secret:"must-not-leak"},
   hourly:[{time:"2026-11-24T01:00:00Z",temperatureC:29,lat:14.5,lng:120.9}],
  } as unknown as import("../src/lib/ai/types").WeatherDataPayload;
  const prompt=buildAIRequest({question:"Weather?",weather:hostile}).userPrompt;
  expect(prompt).toContain('"temperatureC":30');
  expect(prompt).not.toContain("latitude");
  expect(prompt).not.toContain("longitude");
  expect(prompt).not.toContain("must-not-leak");
  expect(prompt).not.toContain('"lat"');
 });
});
beforeEach(()=>{vi.stubEnv("GEMINI_API_KEY","");vi.stubEnv("GROQ_API_KEY","");vi.stubEnv("AI_PROVIDER","gemini");});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
