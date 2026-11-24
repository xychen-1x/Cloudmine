import "server-only";
import type { AIError, AIErrorCode, ProviderFailure, Result } from "./types";
export const fail = <T = never>(error:AIError):Result<T,AIError> => ({ok:false,error});
export function publicError(code:AIErrorCode,provider?:"gemini"|"groq",timeoutScope?:"provider"|"overall"):AIError {
 const messages:Record<AIErrorCode,string>={not_configured:"AI is not configured.",invalid_argument:"The AI request is invalid.",rate_limited:"The AI provider is temporarily rate limited.",timeout:"The AI request timed out.",aborted:"The AI request was cancelled.",auth:"The AI provider rejected its credentials.",bad_request:"The AI provider rejected the request.",safety_blocked:"The AI provider blocked this request.",provider_unavailable:"The AI provider is temporarily unavailable.",unknown:"The AI provider returned an unexpected result."};
 return {code,retryable:["rate_limited","provider_unavailable"].includes(code)||(code==="timeout"&&timeoutScope==="provider"),...(provider?{provider}:{}),...(timeoutScope?{timeoutScope}:{}),message:messages[code]};
}
export function toPublicError(error:ProviderFailure):AIError {
 if(error.code==="signal_aborted") return publicError("unknown",error.provider);
 const e=publicError(error.code,error.provider,error.timeoutScope);
 return {...e,...(error.retryAfterMs?{retryAfterMs:error.retryAfterMs}:{})};
}
