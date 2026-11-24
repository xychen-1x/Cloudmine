import "server-only";
export type WeatherDataPayload = {
  kind: "weather-data"; source: "open-meteo"; fetchedAt: string; locationLabel: string;
  current?: { temperatureC?: number; apparentTemperatureC?: number; relativeHumidityPercent?: number; precipitationMm?: number; windSpeedKmh?: number; windDirectionDegrees?: number; weatherCode?: number };
  hourly?: Array<{ time: string; temperatureC?: number; precipitationProbabilityPercent?: number; precipitationMm?: number; windSpeedKmh?: number }>;
  daily?: Array<{ date: string; minTemperatureC?: number; maxTemperatureC?: number; precipitationProbabilityPercent?: number; precipitationMm?: number; weatherCode?: number }>;
};
export type ConversationMessage = { role: "user" | "assistant"; content: string };
export type AIExplainInput = { question: string; locationLabel?: string; weather?: WeatherDataPayload; messages?: readonly ConversationMessage[] };
export type AIRequest = { systemPrompt: string; userPrompt: string };
export type AIExplanation = { kind: "ai-explanation"; text: string; provider: "gemini" | "groq"; model: string; generatedAt: string; basedOn?: { source: "open-meteo"; fetchedAt: string }; finishReason: "stop" | "length" | "blocked" | "other" };
export type AIErrorCode = "not_configured" | "invalid_argument" | "rate_limited" | "timeout" | "aborted" | "auth" | "bad_request" | "safety_blocked" | "provider_unavailable" | "unknown";
export type AIError = { code: AIErrorCode; retryable: boolean; timeoutScope?: "provider" | "overall"; fallbackSkipped?: "insufficient_time"; notStarted?: "insufficient_time"; retryAfterMs?: number; provider?: "gemini" | "groq"; message: string };
export type Result<T,E> = { ok:true; value:T } | { ok:false; error:E };
export type ProviderSuccess = { text:string; model:string; finishReason:AIExplanation["finishReason"] };
export type ProviderFailure = Omit<AIError,"code"> & { code:AIErrorCode | "signal_aborted" };
export interface AIProvider { readonly name:"gemini" | "groq"; generate(input:AIRequest,signal:AbortSignal):Promise<Result<ProviderSuccess,ProviderFailure>> }
