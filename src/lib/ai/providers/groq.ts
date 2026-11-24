import "server-only";
import type { AIProvider,ProviderFailure,ProviderSuccess,Result } from "../types";
import { GROQ_MODEL,MAX_OUTPUT_TOKENS } from "../models";
import { failure,classifyHttp,finishReason } from "./shared";
export function createGroqProvider(apiKey:string):AIProvider{
 return {name:"groq",async generate(input,signal):Promise<Result<ProviderSuccess,ProviderFailure>>{
  let response:Response;
  try{response=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",signal,headers:{"content-type":"application/json",authorization:"Bearer "+apiKey},body:JSON.stringify({model:GROQ_MODEL,messages:[{role:"system",content:input.systemPrompt},{role:"user",content:input.userPrompt}],temperature:0.35,max_completion_tokens:MAX_OUTPUT_TOKENS})});}
  catch{return {ok:false,error:failure(signal.aborted?"signal_aborted":"provider_unavailable","groq")};}
  if(!response.ok)return {ok:false,error:classifyHttp(response.status,"groq")};
  let body:unknown;try{body=await response.json();}catch{return {ok:false,error:failure(signal.aborted?"signal_aborted":"unknown","groq")};}
  const choice=(body as {choices?:Array<{message?:{content?:string};finish_reason?:string}>})?.choices?.[0];
  const text=choice?.message?.content?.trim();const reason=finishReason(choice?.finish_reason);
  if(!text&&reason==="blocked")return {ok:false,error:failure("safety_blocked","groq")};
  if(!text)return {ok:false,error:failure("unknown","groq")};
  return {ok:true,value:{text,model:GROQ_MODEL,finishReason:reason}};
 }};
}
