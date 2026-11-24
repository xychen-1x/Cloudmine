import "server-only";

import { weatherFailure } from "./errors";
import { parseForecastResponse } from "./validation";
import type { ResolvedLocation, WeatherResult, WeatherForecast } from "./types";

export const FORECAST_REVALIDATE_SECONDS = 600;
export const FORECAST_EQUIVALENT_CALL_WEIGHT = 1.2;

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT_MS = 8_000;

const CURRENT_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "weather_code",
] as const;

const HOURLY_VARIABLES = [
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
] as const;

const DAILY_VARIABLES = [
  "temperature_2m_max",
  "temperature_2m_min",
  "weather_code",
  "precipitation_probability_max",
] as const;

type CooldownState = {
  until: number;
  level: 1 | 2;
};

const rateLimitCooldowns = new Map<number, CooldownState>();

function buildForecastUrl(location: ResolvedLocation): URL {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current", CURRENT_VARIABLES.join(","));
  url.searchParams.set("hourly", HOURLY_VARIABLES.join(","));
  url.searchParams.set("daily", DAILY_VARIABLES.join(","));
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("precipitation_unit", "mm");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  return url;
}

export async function getPhilippineForecast(
  location: ResolvedLocation,
): Promise<WeatherResult<WeatherForecast>> {
  const now = Date.now();
  const cooldown = rateLimitCooldowns.get(location.id);

  if (cooldown && cooldown.until > now) {
    return weatherFailure(
      "rate_limited",
      Math.max(1, Math.ceil((cooldown.until - now) / 1_000)),
    );
  }

  const startedAt = now;
  const url = buildForecastUrl(location);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: FORECAST_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 429) {
      const nextLevel: 1 | 2 = cooldown ? 2 : 1;
      const retryAfterSeconds = nextLevel === 1 ? 60 : 300;
      rateLimitCooldowns.set(location.id, {
        until: Date.now() + retryAfterSeconds * 1_000,
        level: nextLevel,
      });
      console.warn("[weathercast] forecast_rate_limited", {
        locationId: location.id,
        retryAfterSeconds,
      });
      return weatherFailure("rate_limited", retryAfterSeconds);
    }

    if (!response.ok) {
      console.warn("[weathercast] forecast_upstream_error", {
        locationId: location.id,
        status: response.status,
      });
      return weatherFailure("upstream_unavailable");
    }

    const payload: unknown = await response.json();
    const forecast = parseForecastResponse(payload, location.timezone);
    if (!forecast) {
      console.error("[weathercast] forecast_invalid_response", {
        locationId: location.id,
      });
      return weatherFailure("invalid_response");
    }

    rateLimitCooldowns.delete(location.id);
    console.info("[weathercast] forecast_data_loaded", {
      locationId: location.id,
      elapsedMs: Math.max(0, Date.now() - startedAt),
    });

    return { ok: true, value: forecast };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.warn("[weathercast] forecast_request_failed", {
      locationId: location.id,
      reason: timedOut ? "timeout" : "network",
    });
    return weatherFailure(timedOut ? "timeout" : "upstream_unavailable");
  }
}
