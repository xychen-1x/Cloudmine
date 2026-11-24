import "server-only";
import type { AIError, AIProvider, Result } from "./types";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
export type AIConfig={chain:AIProvider[]};
export function readConfig(env:NodeJS.ProcessEnv=process.env):Result<AIConfig,AIError>{
 const selected=(env.AI_PROVIDER??"").trim().toLowerCase();
 if(selected&&selected!=="gemini") return {ok:false,error:{code:"not_configured",retryable:false,message:"Unsupported AI_PROVIDER. Use gemini."}};
 const geminiKey=(env.GEMINI_API_KEY??"").trim(); const groqKey=(env.GROQ_API_KEY??"").trim();
 if(!geminiKey) return {ok:false,error:{code:"not_configured",retryable:false,message:"GEMINI_API_KEY is required."}};
 const chain:AIProvider[]=[createGeminiProvider(geminiKey)]; if(groqKey) chain.push(createGroqProvider(groqKey));
 return {ok:true,value:{chain}};
}
