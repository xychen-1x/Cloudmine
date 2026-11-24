import {afterEach,describe,expect,it,vi} from "vitest";
import {readConfig} from "../src/lib/ai/config";
import {buildAIRequest} from "../src/lib/ai/prompts";
import type {WeatherDataPayload} from "../src/lib/ai/types";

describe("lazy provider configuration",()=>{
 afterEach(()=>vi.unstubAllEnvs());
 it("defaults to Gemini when provider is unset or empty",()=>{
  vi.stubEnv("GEMINI_API_KEY","test-gemini-key");vi.stubEnv("GROQ_API_KEY","");vi.stubEnv("AI_PROVIDER","");
  expect(readConfig().ok).toBe(true);
  vi.stubEnv("AI_PROVIDER","  ");
  expect(readConfig().ok).toBe(true);
 });
 it("rejects Groq primary and unknown providers",()=>{
  vi.stubEnv("GEMINI_API_KEY","test-gemini-key");vi.stubEnv("AI_PROVIDER","groq");
  expect(readConfig()).toMatchObject({ok:false,error:{code:"not_configured"}});
  vi.stubEnv("AI_PROVIDER","other");
  expect(readConfig()).toMatchObject({ok:false,error:{code:"not_configured"}});
 });
 it("never promotes Groq when Gemini key is missing",()=>{
  vi.stubEnv("GEMINI_API_KEY","");vi.stubEnv("GROQ_API_KEY","test-groq-key");
  expect(readConfig()).toMatchObject({ok:false,error:{code:"not_configured"}});
 });
 it("uses Groq only as fallback when both keys exist",()=>{
  vi.stubEnv("GEMINI_API_KEY","test-gemini-key");vi.stubEnv("GROQ_API_KEY","test-groq-key");
  const config=readConfig();expect(config.ok).toBe(true);
  if(config.ok)expect(config.value.chain.map(p=>p.name)).toEqual(["gemini","groq"]);
 });
});
describe("prompt provenance and coordinate boundary",()=>{
 it("does not allow coordinates in the weather type",()=>{
  const bad:WeatherDataPayload={kind:"weather-data",source:"open-meteo",fetchedAt:"2026-11-24T00:00:00Z",locationLabel:"Manila",
   // @ts-expect-error coordinates must never enter the AI payload
   latitude:14.5};
  expect(bad.locationLabel).toBe("Manila");
 });
 it("keeps supplied weather data distinct from the AI request",()=>{
  const weather:WeatherDataPayload={kind:"weather-data",source:"open-meteo",fetchedAt:"2026-11-24T00:00:00Z",locationLabel:"Manila",current:{temperatureC:30}};
  const request=buildAIRequest({question:"Uulan ba?",weather});
  expect(request.userPrompt).toContain('"temperatureC":30');
  expect(request.userPrompt).not.toContain("latitude");
 });
});
