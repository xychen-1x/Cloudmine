import "server-only";
import type {AIExplainInput,AIExplanation,AIError,Result} from "./types";
import {readConfig} from "./config";
import {buildAIRequest} from "./prompts";
import {runProviderChain} from "./orchestrator";
import {LIMITS,validateLimits,invalidLimits,type Limits} from "./limits";
export type {AIExplainInput,AIExplanation,AIError,Result,WeatherDataPayload} from "./types";
export {LIMITS,type Limits} from "./limits";
export async function generate(input:AIExplainInput,caller?:AbortSignal,limits:Limits=LIMITS,clock:()=>number=()=>performance.now()):Promise<Result<AIExplanation,AIError>>{
 const bad=validateLimits(limits);if(bad.length)return invalidLimits(bad);
 const config=readConfig();if(!config.ok)return config;
 const generated=await runProviderChain(buildAIRequest(input),config.value.chain,caller,limits,clock);
 if(!generated.ok)return generated;
 return {ok:true,value:{kind:"ai-explanation",text:generated.value.text,provider:generated.value.model==="openai/gpt-oss-20b"?"groq":"gemini",model:generated.value.model,generatedAt:new Date().toISOString(),...(input.weather?{basedOn:{source:"open-meteo" as const,fetchedAt:input.weather.fetchedAt}}:{}),finishReason:generated.value.finishReason}};
}
