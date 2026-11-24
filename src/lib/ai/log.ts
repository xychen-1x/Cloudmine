import "server-only";
import {AI_BUNDLE_SENTINEL} from "./sentinel";
export type AIEvent={provider:"gemini"|"groq";model?:string;outcome:"success"|"failed";errorCode?:string;httpStatusClass?:string;latencyMs?:number};
export function logAIEvent(event:AIEvent):void{
 const safe={provider:event.provider,...(event.model?{model:event.model}:{}),outcome:event.outcome,...(event.errorCode?{errorCode:event.errorCode}:{}),...(event.httpStatusClass?{httpStatusClass:event.httpStatusClass}:{}),...(Number.isFinite(event.latencyMs)?{latencyMs:Math.max(0,Math.round(event.latencyMs!))}:{})};
 console.info("["+AI_BUNDLE_SENTINEL+"]",safe);
}
