import "server-only";

import { weatherFailure } from "./errors";
import { parseLocationByIdResponse, parseLocationSearchResponse } from "./validation";
import type { LocationSearchItem, ResolvedLocation, WeatherResult } from "./types";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1";
const REQUEST_TIMEOUT_MS = 8_000;

function isValidQuery(query: string): boolean {
  return query.length >= 2 && query.length <= 80;
}

function toSearchItem(location: ResolvedLocation): LocationSearchItem {
  return {
    id: location.id,
    name: location.name,
    admin1: location.admin1,
    country: location.country,
    countryCode: location.countryCode,
    timezone: location.timezone,
  };
}

export async function searchPhilippineLocations(
  rawQuery: string,
): Promise<WeatherResult<LocationSearchItem[]>> {
  const query = rawQuery.trim();
  if (!isValidQuery(query)) return weatherFailure("invalid_response");

  const url = new URL(`${GEOCODING_URL}/search`);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("countryCode", "PH");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 429) return weatherFailure("rate_limited", 60);
    if (!response.ok) return weatherFailure("upstream_unavailable");

    const payload: unknown = await response.json();
    const locations = parseLocationSearchResponse(payload);
    if (!locations) return weatherFailure("invalid_response");

    return { ok: true, value: locations.slice(0, 8).map(toSearchItem) };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return weatherFailure("timeout");
    }
    return weatherFailure("upstream_unavailable");
  }
}

export async function resolvePhilippineLocation(
  id: number,
): Promise<WeatherResult<ResolvedLocation>> {
  if (!Number.isSafeInteger(id) || id <= 0) return weatherFailure("not_found");

  const url = new URL(`${GEOCODING_URL}/get`);
  url.searchParams.set("id", String(id));
  url.searchParams.set("language", "en");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.status === 404) return weatherFailure("not_found");
    if (response.status === 429) return weatherFailure("rate_limited", 60);
    if (!response.ok) return weatherFailure("upstream_unavailable");

    const payload: unknown = await response.json();
    const location = parseLocationByIdResponse(payload, id);
    if (!location) return weatherFailure("not_found");

    return { ok: true, value: location };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return weatherFailure("timeout");
    }
    return weatherFailure("upstream_unavailable");
  }
}
