import "server-only";
import type { AIProvider,ProviderFailure,ProviderSuccess,Result } from "../types";
import { GEMINI_MODEL,MAX_OUTPUT_TOKENS } from "../models";
import { failure,classifyHttp,finishReason } from "./shared";
export function createGeminiProvider(apiKey:string):AIProvider{
 return {name:"gemini",async generate(input,signal):Promise<Result<ProviderSuccess,ProviderFailure>>{
  let response:Response;
  try{response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+GEMINI_MODEL+":generateContent",{method:"POST",signal,headers:{"content-type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({systemInstruction:{parts:[{text:input.systemPrompt}]},contents:[{role:"user",parts:[{text:input.userPrompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:MAX_OUTPUT_TOKENS}})});}
  catch{return {ok:false,error:failure(signal.aborted?"signal_aborted":"provider_unavailable","gemini")};}
  if(!response.ok)return {ok:false,error:classifyHttp(response.status,"gemini")};
  let body:unknown;try{body=await response.json();}catch{return {ok:false,error:failure(signal.aborted?"signal_aborted":"unknown","gemini")};}
  const candidate=(body as {candidates?:Array<{content?:{parts?:Array<{text?:string}>};finishReason?:string}>})?.candidates?.[0];
  const text=candidate?.content?.parts?.map(part=>part.text??"").join("").trim();const reason=finishReason(candidate?.finishReason);
  if(!text&&reason==="blocked")return {ok:false,error:failure("safety_blocked","gemini")};
  if(!text)return {ok:false,error:failure("unknown","gemini")};
  return {ok:true,value:{text,model:GEMINI_MODEL,finishReason:reason}};
 }};
}
