import "server-only";
import type { AIError, Result } from "./types";
export type Limits={totalBudgetMs:number;primaryTimeoutMs:number;fallbackTimeoutMs:number;minFallbackMs:number;minAttemptMs:number};
export const LIMITS:Limits={totalBudgetMs:25000,primaryTimeoutMs:12000,fallbackTimeoutMs:10000,minFallbackMs:3000,minAttemptMs:500};
export const MAX_LIMIT_MS=2**31-1;
export function validateLimits(value:unknown):string[] {
 if(!value||typeof value!=="object") return ["limits"];
 const v=value as Record<string,unknown>; const keys:(keyof Limits)[]=["totalBudgetMs","primaryTimeoutMs","fallbackTimeoutMs","minFallbackMs","minAttemptMs"];
 const bad=keys.filter(k=>typeof v[k]!=="number"||!Number.isFinite(v[k])||!Number.isInteger(v[k])||(v[k] as number)<1||(v[k] as number)>MAX_LIMIT_MS);
 if(bad.length) return bad;
 const l=value as Limits;
 if(l.minFallbackMs<l.minAttemptMs) bad.push("minFallbackMs");
 if(l.totalBudgetMs-l.minFallbackMs<l.minAttemptMs) bad.push("totalBudgetMs");
 if(l.primaryTimeoutMs<l.minAttemptMs) bad.push("primaryTimeoutMs");
 if(l.fallbackTimeoutMs<l.minAttemptMs) bad.push("fallbackTimeoutMs");
 return [...new Set(bad)];
}
export function invalidLimits(fields:string[]):Result<never,AIError>{return {ok:false,error:{code:"invalid_argument",retryable:false,message:"Invalid limits: "+fields.join(", ")}};}
