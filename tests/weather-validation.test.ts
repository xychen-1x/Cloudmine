import { describe, expect, it } from "vitest";
import {
  parseForecastResponse,
  parseLocationByIdResponse,
  parseLocationSearchResponse,
} from "@/lib/weather/validation";
import { getFreshnessState, getSourceAgeMinutes } from "@/lib/weather/freshness";
import { describeWeatherCode } from "@/lib/weather/weather-codes";

function location(id: number, countryCode = "PH") {
  return {
    id,
    name: "Manila",
    latitude: 14.5995,
    longitude: 120.9842,
    country: countryCode === "PH" ? "Philippines" : "Other",
    country_code: countryCode,
    admin1: "Metro Manila",
    timezone: "Asia/Manila",
  };
}

function forecastPayload() {
  const times = Array.from({ length: 48 }, (_, index) => {
    const hour = index % 24;
    const day = 24 + Math.floor(index / 24);
    return `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;
  });

  return {
    timezone: "Asia/Manila",
    current: {
      time: "2026-11-24T08:00",
      temperature_2m: 30.2,
      apparent_temperature: 35.1,
      relative_humidity_2m: 72,
      weather_code: 2,
    },
    hourly: {
      time: times,
      temperature_2m: times.map((_, index) => 29 - index / 10),
      precipitation_probability: times.map(() => 25),
      precipitation: times.map(() => 0),
      weather_code: times.map(() => 2),
    },
    daily: {
      time: [
        "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27",
        "2026-11-28", "2026-11-29", "2026-11-30",
      ],
      temperature_2m_max: [32, 32, 31, 30, 31, 32, 32],
      temperature_2m_min: [25, 25, 24, 24, 25, 25, 25],
      precipitation_probability_max: [20, 35, 60, 70, 25, 15, 10],
      weather_code: [2, 3, 61, 63, 2, 1, 0],
    },
  };
}

describe("Open-Meteo payload validation", () => {
  it("keeps only valid Philippine locations and caps the result at eight", () => {
    const results = Array.from({ length: 10 }, (_, index) => location(index + 1));
    results.push(location(99, "US"));
    const parsed = parseLocationSearchResponse({ results });

    expect(parsed).toHaveLength(8);
    expect(parsed?.every((item) => item.countryCode === "PH")).toBe(true);
    expect(parsed?.[0]).toMatchObject({
      id: 1,
      name: "Manila",
      admin1: "Metro Manila",
      timezone: "Asia/Manila",
    });
  });

  it("rejects malformed location records and non-Philippine ID lookups", () => {
    expect(parseLocationSearchResponse({ results: [{ id: "not-a-number" }] })).toEqual([]);
    expect(parseLocationSearchResponse({ error: true })).toBeNull();
    expect(parseLocationByIdResponse(location(7, "US"), 7)).toBeNull();
    expect(parseLocationByIdResponse(location(8), 7)).toBeNull();
  });

  it("maps exactly 24 future hourly points and seven daily points", () => {
    const parsed = parseForecastResponse(forecastPayload(), "Asia/Manila");

    expect(parsed).not.toBeNull();
    expect(parsed?.current.temperatureC).toBe(30.2);
    expect(parsed?.current.apparentTemperatureC).toBe(35.1);
    expect(parsed?.hourly).toHaveLength(24);
    expect(parsed?.hourly[0].time).toBe("2026-11-24T08:00");
    expect(parsed?.daily).toHaveLength(7);
    expect(parsed?.daily[0].maxTemperatureC).toBe(32);
  });

  it("rejects misaligned arrays, invalid probabilities and reversed daily ranges", () => {
    const misaligned = forecastPayload();
    misaligned.hourly.temperature_2m.pop();
    expect(parseForecastResponse(misaligned, "Asia/Manila")).toBeNull();

    const invalidProbability = forecastPayload();
    invalidProbability.daily.precipitation_probability_max[0] = 120;
    expect(parseForecastResponse(invalidProbability, "Asia/Manila")).toBeNull();

    const reversedRange = forecastPayload();
    reversedRange.daily.temperature_2m_min[0] = 35;
    expect(parseForecastResponse(reversedRange, "Asia/Manila")).toBeNull();

    const invalidCalendarDate = forecastPayload();
    invalidCalendarDate.daily.time[0] = "2026-02-31";
    expect(parseForecastResponse(invalidCalendarDate, "Asia/Manila")).toBeNull();

    const unorderedHours = forecastPayload();
    [unorderedHours.hourly.time[0], unorderedHours.hourly.time[1]] =
      [unorderedHours.hourly.time[1], unorderedHours.hourly.time[0]];
    expect(parseForecastResponse(unorderedHours, "Asia/Manila")).toBeNull();
  });
});

describe("source freshness and weather codes", () => {
  it("converts Philippine local model time to a real timestamp", () => {
    const now = Date.UTC(2026, 10, 24, 13, 0);
    expect(getSourceAgeMinutes("2026-11-24T20:00", "Asia/Manila", now)).toBe(60);
  });

  it("applies the approved 60/90-minute current-data thresholds", () => {
    expect(getFreshnessState(60)).toBe("fresh");
    expect(getFreshnessState(61)).toBe("stale");
    expect(getFreshnessState(90)).toBe("stale");
    expect(getFreshnessState(91)).toBe("expired");
    expect(getFreshnessState(null)).toBe("unknown");
  });

  it("does not label an invalid or far-future timestamp as fresh", () => {
    const now = Date.UTC(2026, 10, 24, 13, 0);
    expect(getSourceAgeMinutes("not-a-time", "Asia/Manila", now)).toBeNull();
    expect(getSourceAgeMinutes("2026-11-25T08:00", "Asia/Manila", now)).toBeNull();
  });

  it("maps documented WMO weather codes and safely handles unknown values", () => {
    expect(describeWeatherCode(95).label).toBe("Thunderstorm");
    expect(describeWeatherCode(0).label).toBe("Clear sky");
    expect(describeWeatherCode(88).label).toBe("Variable conditions");
    expect(describeWeatherCode(null).label).toBe("Conditions unavailable");
  });
});
