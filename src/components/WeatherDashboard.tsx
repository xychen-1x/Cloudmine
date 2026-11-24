"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFreshnessState, getSourceAgeMinutes } from "@/lib/weather/freshness";
import { describeWeatherCode } from "@/lib/weather/weather-codes";
import type {
  DailyWeather,
  HourlyWeather,
  LocationSearchItem,
  WeatherForecast,
} from "@/lib/weather/types";

type Props = {
  location: LocationSearchItem;
  forecast: WeatherForecast | null;
  initialAgeMinutes: number | null;
  errorMessage?: string;
};

function formatTemperature(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}°`;
}

function formatTime(value: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  if (!match) return "—";
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

function formatDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function precipitationLabel(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function freshnessCopy(state: ReturnType<typeof getFreshnessState>, age: number | null): string {
  if (state === "fresh") return age === null ? "Fresh" : `Updated ${age} min ago`;
  if (state === "stale") return age === null ? "Slightly delayed" : `Delayed · ${age} min old`;
  if (state === "expired") return "Current data paused · too old";
  return "Freshness could not be verified";
}

function HourCard({ item }: { item: HourlyWeather }) {
  const weather = describeWeatherCode(item.weatherCode);
  return (
    <article className="hour-card">
      <p className="hour-time">{formatTime(item.time)}</p>
      <span className="hour-icon" aria-hidden="true">{weather.icon}</span>
      <p className="hour-temp">{formatTemperature(item.temperatureC)}</p>
      <p className="hour-rain">☔ {precipitationLabel(item.precipitationProbabilityPercent)}</p>
    </article>
  );
}

function DayRow({ item }: { item: DailyWeather }) {
  const weather = describeWeatherCode(item.weatherCode);
  return (
    <div className="day-row">
      <span className="day-name">{formatDay(item.date)}</span>
      <span className="day-weather">
        <span aria-hidden="true">{weather.icon}</span>
        <span>{weather.label}</span>
      </span>
      <span className="day-rain">☔ {precipitationLabel(item.precipitationProbabilityPercent)}</span>
      <span className="day-temperatures">
        <strong>{formatTemperature(item.maxTemperatureC)}</strong>
        <span>{formatTemperature(item.minTemperatureC)}</span>
      </span>
    </div>
  );
}

export function WeatherDashboard({
  location,
  forecast,
  initialAgeMinutes,
  errorMessage,
}: Props) {
  const [ageMinutes, setAgeMinutes] = useState<number | null>(initialAgeMinutes);

  useEffect(() => {
    if (!forecast) return;
    const updateAge = () => {
      setAgeMinutes(getSourceAgeMinutes(forecast.current.time, forecast.timezone));
    };
    updateAge();
    const timer = window.setInterval(updateAge, 60_000);
    return () => window.clearInterval(timer);
  }, [forecast]);

  const freshness = getFreshnessState(ageMinutes);
  const currentCanBePresented = freshness === "fresh" || freshness === "stale";
  const forecastCanBePresented = ageMinutes !== null && ageMinutes <= 360;
  const currentDescription = forecast
    ? describeWeatherCode(forecast.current.weatherCode)
    : null;

  return (
    <main className="weather-page">
      <div className="weather-page-top">
        <Link className="brand brand-small" href="/" aria-label="Weathercast home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>weathercast</span>
        </Link>
        <span className="region-pill">PHILIPPINES</span>
      </div>

      <section className="location-heading">
        <p className="eyebrow">LOCAL WEATHER</p>
        <h1>{location.name}</h1>
        <p className="location-subtitle">
          {[location.admin1, location.country].filter(Boolean).join(", ")}
          <span className="location-dot">·</span>
          {forecast?.timezone ?? location.timezone}
        </p>
      </section>

      {!forecast ? (
        <section className="notice-card notice-error" role="alert">
          <h2>Weather data is temporarily unavailable</h2>
          <p>{errorMessage ?? "Please try again in a little while."}</p>
          <p>Your location selection is saved in this page address. You can retry by refreshing.</p>
        </section>
      ) : (
        <>
          <section className={`freshness-banner freshness-${freshness}`} aria-live="polite">
            <span className="freshness-dot" aria-hidden="true" />
            <span>{freshnessCopy(freshness, ageMinutes)}</span>
            <span className="freshness-time">Model time: {formatTime(forecast.current.time)}</span>
          </section>

          {!currentCanBePresented ? (
            <section className="notice-card notice-warning" role="status">
              <h2>Current conditions are no longer shown</h2>
              <p>
                The model timestamp is more than 90 minutes old or could not be verified.
                We will not label old conditions as current.
              </p>
            </section>
          ) : (
            <section className="current-card" aria-label="Current weather conditions">
              <div className="current-overview">
                <div>
                  <p className="card-kicker">CURRENT CONDITIONS</p>
                  <p className="current-temperature">{formatTemperature(forecast.current.temperatureC)}</p>
                  <p className="current-description">{currentDescription?.label}</p>
                </div>
                <span className="current-icon" aria-hidden="true">{currentDescription?.icon}</span>
              </div>
              <div className="current-details">
                <div className="detail-tile">
                  <span className="detail-symbol" aria-hidden="true">🌡️</span>
                  <span className="detail-label">Feels like</span>
                  <strong>{formatTemperature(forecast.current.apparentTemperatureC)}</strong>
                </div>
                <div className="detail-tile">
                  <span className="detail-symbol" aria-hidden="true">💧</span>
                  <span className="detail-label">Humidity</span>
                  <strong>
                    {forecast.current.relativeHumidityPercent === null
                      ? "—"
                      : `${Math.round(forecast.current.relativeHumidityPercent)}%`}
                  </strong>
                </div>
                <div className="detail-tile">
                  <span className="detail-symbol" aria-hidden="true">🕒</span>
                  <span className="detail-label">Model time</span>
                  <strong>{formatTime(forecast.current.time)}</strong>
                </div>
              </div>
            </section>
          )}

          {forecastCanBePresented ? (
            <>
              <section className="forecast-section" aria-labelledby="hourly-title">
                <div className="section-heading">
                  <div>
                    <p className="card-kicker">PLAN YOUR DAY</p>
                    <h2 id="hourly-title">Next 24 hours</h2>
                  </div>
                  <span className="section-unit">°C · Rain chance</span>
                </div>
                <div className="hourly-strip">
                  {forecast.hourly.map((item) => <HourCard key={item.time} item={item} />)}
                </div>
              </section>

              <section className="forecast-section daily-section" aria-labelledby="daily-title">
                <div className="section-heading">
                  <div>
                    <p className="card-kicker">THE WEEK AHEAD</p>
                    <h2 id="daily-title">7-day forecast</h2>
                  </div>
                  <span className="section-unit">High / Low</span>
                </div>
                <div className="daily-list">
                  {forecast.daily.map((item) => <DayRow key={item.date} item={item} />)}
                </div>
              </section>
            </>
          ) : (
            <section className="notice-card notice-warning" role="status">
              <h2>Forecast temporarily hidden</h2>
              <p>
                The last available model data is more than six hours old.
                Refresh later for a newly validated forecast.
              </p>
            </section>
          )}
        </>
      )}

      <footer className="weather-footer">
        <p>
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>
          {" "}· Location data based on <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>
        </p>
        <p>Weathercast is non-commercial and ad-free. Model data is not an official PAGASA warning.</p>
      </footer>
    </main>
  );
}
