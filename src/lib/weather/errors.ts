import type { WeatherError, WeatherErrorCode, WeatherResult } from "./types";

const MESSAGES: Record<WeatherErrorCode, string> = {
  not_found: "That Philippine location could not be found.",
  rate_limited: "The weather service is temporarily rate-limiting requests.",
  upstream_unavailable: "Weather data is temporarily unavailable. Please try again.",
  invalid_response: "The weather service returned data in an unexpected format.",
  timeout: "The weather service took too long to respond.",
  stale_data: "The latest weather data is too old to display safely.",
};

export function weatherError(
  code: WeatherErrorCode,
  retryAfterSeconds?: number,
): WeatherError {
  return {
    code,
    message: MESSAGES[code],
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
}

export function weatherFailure<T = never>(
  code: WeatherErrorCode,
  retryAfterSeconds?: number,
): WeatherResult<T> {
  return { ok: false, error: weatherError(code, retryAfterSeconds) };
}
