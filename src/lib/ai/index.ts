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
 if(!input||typeof input!=="object"||typeof input.question!=="string"||!input.question.trim())return {ok:false,error:{code:"invalid_argument",retryable:false,message:"A non-empty question is required."}};
 const config=readConfig();if(!config.ok)return config;
 const generated=await runProviderChain(buildAIRequest(input),config.value.chain,caller,limits,clock);
 if(!generated.ok)return generated;
 return {ok:true,value:{kind:"ai-explanation",text:generated.value.text,provider:generated.value.provider,model:generated.value.model,generatedAt:new Date().toISOString(),...(input.weather?{basedOn:{source:"open-meteo" as const,fetchedAt:input.weather.fetchedAt}}:{}),finishReason:generated.value.finishReason}};
}
