export type WeatherErrorCode =
  | "not_found"
  | "rate_limited"
  | "upstream_unavailable"
  | "invalid_response"
  | "timeout"
  | "stale_data";

export type WeatherError = {
  code: WeatherErrorCode;
  message: string;
  retryAfterSeconds?: number;
};

export type WeatherResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WeatherError };

export type LocationSearchItem = {
  id: number;
  name: string;
  admin1: string | null;
  country: string;
  countryCode: "PH";
  timezone: string;
};

export type ResolvedLocation = LocationSearchItem & {
  latitude: number;
  longitude: number;
};

export type CurrentWeather = {
  time: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  relativeHumidityPercent: number | null;
  weatherCode: number | null;
};

export type HourlyWeather = {
  time: string;
  temperatureC: number | null;
  precipitationProbabilityPercent: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
};

export type DailyWeather = {
  date: string;
  minTemperatureC: number | null;
  maxTemperatureC: number | null;
  weatherCode: number | null;
  precipitationProbabilityPercent: number | null;
};

export type WeatherForecast = {
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyWeather[];
  daily: DailyWeather[];
};
