import "server-only";
import type { ProviderFailure } from "../types";
export function failure(code:ProviderFailure["code"],provider:"gemini"|"groq",extra:Partial<ProviderFailure>={}):ProviderFailure{
 const messages:Record<string,string>={signal_aborted:"Provider request was aborted.",rate_limited:"Provider rate limit reached.",provider_unavailable:"Provider unavailable.",auth:"Provider authentication failed.",bad_request:"Provider rejected request.",safety_blocked:"Provider safety block.",unknown:"Unexpected provider response."};
 return {code,retryable:code==="rate_limited"||code==="provider_unavailable",provider,message:messages[code]??"Provider request failed.",...extra};
}
export function classifyHttp(status:number,provider:"gemini"|"groq"):ProviderFailure{
 if(status===401||status===403)return failure("auth",provider);
 if(status===429)return failure("rate_limited",provider);
 if(status===400||status===404||status===422)return failure("bad_request",provider);
 if(status>=500)return failure("provider_unavailable",provider);
 return failure("unknown",provider);
}
export function finishReason(value:unknown):"stop"|"length"|"blocked"|"other"{
 if(value==="STOP"||value==="stop")return "stop";
 if(value==="MAX_TOKENS"||value==="length")return "length";
 if(value==="SAFETY"||value==="RECITATION"||value==="content_filter")return "blocked";
 return "other";
}
