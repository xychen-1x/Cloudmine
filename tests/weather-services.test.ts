import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPhilippineLocations } from "@/lib/weather/geocoding";
import {
  FORECAST_EQUIVALENT_CALL_WEIGHT,
  FORECAST_REVALIDATE_SECONDS,
  getPhilippineForecast,
} from "@/lib/weather/forecast";
import type { ResolvedLocation } from "@/lib/weather/types";

const location: ResolvedLocation = {
  id: 1701668,
  name: "Manila",
  admin1: "Metro Manila",
  country: "Philippines",
  countryCode: "PH",
  latitude: 14.5995,
  longitude: 120.9842,
  timezone: "Asia/Manila",
};

function openMeteoForecast() {
  const hourlyTimes = Array.from({ length: 48 }, (_, index) => {
    const day = 24 + Math.floor(index / 24);
    const hour = index % 24;
    return `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;
  });
  return {
    timezone: "Asia/Manila",
    current: {
      time: "2026-11-24T08:00",
      temperature_2m: 30,
      apparent_temperature: 34,
      relative_humidity_2m: 75,
      weather_code: 2,
    },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTimes.map(() => 29),
      precipitation_probability: hourlyTimes.map(() => 25),
      precipitation: hourlyTimes.map(() => 0),
      weather_code: hourlyTimes.map(() => 2),
    },
    daily: {
      time: ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"],
      temperature_2m_max: [32, 32, 31, 30, 31, 32, 32],
      temperature_2m_min: [25, 25, 24, 24, 25, 25, 25],
      precipitation_probability_max: [20, 35, 60, 70, 25, 15, 10],
      weather_code: [2, 3, 61, 63, 2, 1, 0],
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Open-Meteo request construction", () => {
  it("sends a Philippine-only geocoding request with a 24-hour data-cache TTL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{
        id: 1701668,
        name: "Manila",
        latitude: 14.5995,
        longitude: 120.9842,
        country: "Philippines",
        country_code: "PH",
        admin1: "Metro Manila",
        timezone: "Asia/Manila",
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchPhilippineLocations(" Manila ");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, options] = fetchMock.mock.calls[0] as [URL, RequestInit & { next?: { revalidate?: number } }];
    expect(requestUrl.searchParams.get("name")).toBe("Manila");
    expect(requestUrl.searchParams.get("countryCode")).toBe("PH");
    expect(requestUrl.searchParams.get("count")).toBe("8");
    expect(options.next?.revalidate).toBe(86_400);
  });

  it("requests the approved 12 variables and caches a forecast for 600 seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(openMeteoForecast()), {
      status: 200,
      headers: {
        "content-type": "application/json",
        date: "Tue, 24 Nov 2026 12:00:00 GMT",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPhilippineForecast({ ...location, id: 1701669 });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.sourceResponseTime).toBe("2026-11-24T12:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, options] = fetchMock.mock.calls[0] as [URL, RequestInit & { next?: { revalidate?: number } }];
    const current = requestUrl.searchParams.get("current")?.split(",") ?? [];
    const hourly = requestUrl.searchParams.get("hourly")?.split(",") ?? [];
    const daily = requestUrl.searchParams.get("daily")?.split(",") ?? [];
    expect(current).toHaveLength(4);
    expect(hourly).toHaveLength(4);
    expect(daily).toHaveLength(4);
    expect(current.length + hourly.length + daily.length).toBe(12);
    expect(requestUrl.searchParams.get("forecast_days")).toBe("7");
    expect(requestUrl.searchParams.get("timezone")).toBe("auto");
    expect(requestUrl.searchParams.get("temperature_unit")).toBe("celsius");
    expect(requestUrl.searchParams.get("precipitation_unit")).toBe("mm");
    expect(options.next?.revalidate).toBe(FORECAST_REVALIDATE_SECONDS);
    expect(FORECAST_EQUIVALENT_CALL_WEIGHT).toBe(1.2);
  });

  it("rejects an invalid HTTP Date header as an unverifiable timestamp", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(openMeteoForecast()), {
      status: 200,
      headers: {
        "content-type": "application/json",
        date: "not-a-valid-http-date",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPhilippineForecast({ ...location, id: 1701672 });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.sourceResponseTime).toBeNull();
  });

  it("does not invent a response timestamp when the HTTP Date header is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(openMeteoForecast()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getPhilippineForecast({ ...location, id: 1701671 });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.sourceResponseTime).toBeNull();
  });

  it("backs off for 60 seconds on the first 429 and 300 seconds after a repeated 429", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T12:00:00.000Z"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getPhilippineForecast({ ...location, id: 1701670 });
    expect(first.ok).toBe(false);
    if (first.ok) throw new Error("Expected first rate limit.");
    expect(first.error.retryAfterSeconds).toBe(60);

    const secondWhileCoolingDown = await getPhilippineForecast({ ...location, id: 1701670 });
    expect(secondWhileCoolingDown.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_001);
    const repeated = await getPhilippineForecast({ ...location, id: 1701670 });
    expect(repeated.ok).toBe(false);
    if (repeated.ok) throw new Error("Expected repeated rate limit.");
    expect(repeated.error.retryAfterSeconds).toBe(300);

    const third = await getPhilippineForecast({ ...location, id: 1701670 });
    expect(third.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
