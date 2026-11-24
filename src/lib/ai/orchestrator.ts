import "server-only";
import type {AIError,AIProvider,AIRequest,ProviderFailure,ProviderSuccess,Result} from "./types";
import type {Limits} from "./limits";
import {LIMITS,validateLimits,invalidLimits} from "./limits";
import {logAIEvent} from "./log";
import {toPublicError,publicError} from "./errors";
const THREW=Symbol("provider-threw-or-malformed");
const providerCodes=new Set(["signal_aborted","rate_limited","timeout","auth","bad_request","safety_blocked","provider_unavailable","unknown"]);
function wellFormed(value:unknown):value is Result<ProviderSuccess,ProviderFailure>{
 if(!value||typeof value!=="object"||!("ok" in value))return false;
 const v=value as {ok:unknown;value?:unknown;error?:unknown};
 if(v.ok===true)return !!v.value&&typeof v.value==="object"&&typeof (v.value as ProviderSuccess).text==="string"&&typeof (v.value as ProviderSuccess).model==="string"&&["stop","length","blocked","other"].includes((v.value as ProviderSuccess).finishReason);
 if(v.ok!==false||!v.error||typeof v.error!=="object")return false;
 const e=v.error as ProviderFailure;return typeof e.code==="string"&&providerCodes.has(e.code)&&typeof e.message==="string"&&typeof e.retryable==="boolean";
}
function providerTimeout(p:AIProvider):AIError{return publicError("timeout",p.name,"provider");}
function unexpected(p:AIProvider):AIError{return {code:"unknown",retryable:false,provider:p.name,message:"Unexpected provider failure."};}
function eligible(e:AIError):boolean{return e.code==="rate_limited"||e.code==="provider_unavailable"||(e.code==="timeout"&&e.timeoutScope==="provider");}
export async function runProviderChain(input:AIRequest,chain:AIProvider[],caller?:AbortSignal,limits:Limits=LIMITS,clock:()=>number=()=>performance.now()):Promise<Result<ProviderSuccess & {provider:"gemini"|"groq"},AIError>>{
 const bad=validateLimits(limits);if(bad.length)return invalidLimits(bad);
 const overall=AbortSignal.timeout(limits.totalBudgetMs);const t0=clock();let last:AIError|undefined;
 for(const [i,p] of chain.entries()){
  const hasNext=i<chain.length-1;
  if(caller?.aborted)return {ok:false,error:publicError("aborted")};
  if(overall.aborted)return {ok:false,error:publicError("timeout",undefined,"overall")};
  const remaining=limits.totalBudgetMs-(clock()-t0);
  if(i>0&&!(remaining>=limits.minFallbackMs))return {ok:false,error:{...last!,fallbackSkipped:"insufficient_time"}};
  const timeoutMs=i===0?limits.primaryTimeoutMs:limits.fallbackTimeoutMs;
  let attemptMs=Math.min(timeoutMs,remaining-(hasNext?limits.minFallbackMs:0));
  if(i===0&&hasNext&&!(attemptMs>=limits.minAttemptMs))attemptMs=Math.min(timeoutMs,remaining);
  attemptMs=Math.floor(attemptMs);
  if(!(attemptMs>=limits.minAttemptMs))return {ok:false,error:{...publicError("timeout",undefined,"overall"),notStarted:"insufficient_time"}};
  const providerTimer=AbortSignal.timeout(attemptMs);
  const signal=AbortSignal.any([...(caller?[caller]:[]),overall,providerTimer]);const started=clock();
  let result:Result<ProviderSuccess,ProviderFailure>|typeof THREW;
  try{const output=await p.generate(input,signal);result=wellFormed(output)?output:THREW;}catch{result=THREW;}
  // Cancellation precedence is evaluated before classifying any provider outcome.
  if(caller?.aborted)return {ok:false,error:publicError("aborted")};
  if(overall.aborted)return {ok:false,error:publicError("timeout",undefined,"overall")};
  const timedOut=providerTimer.aborted;
  if(result===THREW)last=timedOut?providerTimeout(p):unexpected(p);
  else if(result.ok){if(!timedOut){logAIEvent({provider:p.name,outcome:"success",model:result.value.model,latencyMs:clock()-started});return {ok:true,value:{...result.value,provider:p.name}};}last=providerTimeout(p);}
  else if(result.error.code==="signal_aborted")last=timedOut?providerTimeout(p):{code:"unknown",retryable:false,provider:p.name,message:"Provider aborted without a signal."};
  else last=toPublicError(result.error);
  logAIEvent({provider:p.name,outcome:"failed",errorCode:last.code,latencyMs:clock()-started});
  if(!eligible(last))return {ok:false,error:last};
 }
 return {ok:false,error:last??publicError("unknown")};
}
