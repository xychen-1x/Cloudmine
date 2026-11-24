import type {
  CurrentWeather,
  DailyWeather,
  HourlyWeather,
  ResolvedLocation,
  WeatherForecast,
} from "./types";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isWeatherCode(value: unknown): value is number | null {
  return value === null || (
    Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 99
  );
}

function isLocalDateTime(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function isLocalDate(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 3 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function parseLocation(value: unknown): ResolvedLocation | null {
  if (!isObject(value)) return null;

  const id = value.id;
  const name = value.name;
  const country = value.country;
  const countryCode = value.country_code;
  const latitude = value.latitude;
  const longitude = value.longitude;
  const admin1 = value.admin1;
  const timezone = value.timezone;

  if (
    !Number.isSafeInteger(id) ||
    typeof name !== "string" ||
    name.trim().length === 0 ||
    typeof country !== "string" ||
    country.trim().length === 0 ||
    countryCode !== "PH" ||
    !isFiniteNumber(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !isFiniteNumber(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const resolvedTimezone = isTimeZone(timezone) ? timezone : "Asia/Manila";
  return {
    id: id as number,
    name: name.trim(),
    admin1: typeof admin1 === "string" && admin1.trim() ? admin1.trim() : null,
    country: country.trim(),
    countryCode: "PH",
    latitude,
    longitude,
    timezone: resolvedTimezone,
  };
}

export function parseLocationSearchResponse(payload: unknown): ResolvedLocation[] | null {
  if (!isObject(payload) || !Array.isArray(payload.results)) return null;

  const unique = new Map<number, ResolvedLocation>();
  for (const item of payload.results) {
    const location = parseLocation(item);
    if (location) unique.set(location.id, location);
    if (unique.size >= 8) break;
  }

  return [...unique.values()];
}

export function parseLocationByIdResponse(
  payload: unknown,
  requestedId: number,
): ResolvedLocation | null {
  const candidate = isObject(payload) && Array.isArray(payload.results)
    ? payload.results[0]
    : payload;
  const location = parseLocation(candidate);
  return location?.id === requestedId ? location : null;
}

function readNumberArray(
  source: JsonObject,
  key: string,
  expectedLength: number,
): Array<number | null> | null {
  const value = source[key];
  if (!Array.isArray(value) || value.length !== expectedLength) return null;
  if (!value.every(isNullableNumber)) return null;
  return value as Array<number | null>;
}

function readCodeArray(
  source: JsonObject,
  key: string,
  expectedLength: number,
): Array<number | null> | null {
  const value = source[key];
  if (!Array.isArray(value) || value.length !== expectedLength) return null;
  if (!value.every(isWeatherCode)) return null;
  return value as Array<number | null>;
}

function readCurrent(
  source: unknown,
): CurrentWeather | null {
  if (!isObject(source)) return null;
  if (
    !isLocalDateTime(source.time) ||
    !isNullableNumber(source.temperature_2m) ||
    !isNullableNumber(source.apparent_temperature) ||
    !isNullableNumber(source.relative_humidity_2m) ||
    !isWeatherCode(source.weather_code) ||
    (typeof source.relative_humidity_2m === "number" &&
      (source.relative_humidity_2m < 0 || source.relative_humidity_2m > 100))
  ) {
    return null;
  }

  return {
    time: source.time,
    temperatureC: source.temperature_2m,
    apparentTemperatureC: source.apparent_temperature,
    relativeHumidityPercent: source.relative_humidity_2m,
    weatherCode: source.weather_code,
  };
}

export function parseForecastResponse(
  payload: unknown,
  fallbackTimezone: string,
): WeatherForecast | null {
  if (!isObject(payload) || !isObject(payload.hourly) || !isObject(payload.daily)) {
    return null;
  }

  const current = readCurrent(payload.current);
  if (!current) return null;

  const hourlySource = payload.hourly;
  const hourlyTimes = hourlySource.time;
  if (
    !Array.isArray(hourlyTimes) ||
    hourlyTimes.length < 24 ||
    !hourlyTimes.every(isLocalDateTime)
  ) {
    return null;
  }

  const hourlyTemperatures = readNumberArray(hourlySource, "temperature_2m", hourlyTimes.length);
  const hourlyProbabilities = readNumberArray(hourlySource, "precipitation_probability", hourlyTimes.length);
  const hourlyPrecipitation = readNumberArray(hourlySource, "precipitation", hourlyTimes.length);
  const hourlyCodes = readCodeArray(hourlySource, "weather_code", hourlyTimes.length);

  if (!hourlyTemperatures || !hourlyProbabilities || !hourlyPrecipitation || !hourlyCodes) {
    return null;
  }

  if (hourlyProbabilities.some((value) => value !== null && (value < 0 || value > 100))) {
    return null;
  }
  if (hourlyPrecipitation.some((value) => value !== null && value < 0)) return null;

  const firstFutureHour = hourlyTimes.findIndex((time) => time >= current.time);
  if (firstFutureHour < 0 || hourlyTimes.length - firstFutureHour < 24) return null;

  const hourly: HourlyWeather[] = hourlyTimes
    .slice(firstFutureHour, firstFutureHour + 24)
    .map((time, index) => {
      const position = firstFutureHour + index;
      return {
        time,
        temperatureC: hourlyTemperatures[position],
        precipitationProbabilityPercent: hourlyProbabilities[position],
        precipitationMm: hourlyPrecipitation[position],
        weatherCode: hourlyCodes[position],
      };
    });

  const dailySource = payload.daily;
  const dailyTimes = dailySource.time;
  if (
    !Array.isArray(dailyTimes) ||
    dailyTimes.length < 7 ||
    !dailyTimes.every(isLocalDate)
  ) {
    return null;
  }

  const dailyMax = readNumberArray(dailySource, "temperature_2m_max", dailyTimes.length);
  const dailyMin = readNumberArray(dailySource, "temperature_2m_min", dailyTimes.length);
  const dailyProbability = readNumberArray(dailySource, "precipitation_probability_max", dailyTimes.length);
  const dailyCodes = readCodeArray(dailySource, "weather_code", dailyTimes.length);

  if (!dailyMax || !dailyMin || !dailyProbability || !dailyCodes) return null;
  if (dailyProbability.some((value) => value !== null && (value < 0 || value > 100))) return null;

  const daily: DailyWeather[] = dailyTimes.slice(0, 7).map((date, index) => ({
    date,
    minTemperatureC: dailyMin[index],
    maxTemperatureC: dailyMax[index],
    weatherCode: dailyCodes[index],
    precipitationProbabilityPercent: dailyProbability[index],
  }));

  for (const day of daily) {
    if (
      day.minTemperatureC !== null &&
      day.maxTemperatureC !== null &&
      day.minTemperatureC > day.maxTemperatureC
    ) {
      return null;
    }
  }

  return {
    timezone: isTimeZone(payload.timezone) ? payload.timezone : fallbackTimezone,
    current,
    hourly,
    daily,
  };
}
