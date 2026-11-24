"use client";

import Link from "next/link";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function WeatherPageError({ reset }: Props) {
  return (
    <main className="weather-page">
      <section className="notice-card notice-error" role="alert">
        <p className="card-kicker">WEATHERCAST</p>
        <h1>Weather data is temporarily unavailable</h1>
        <p>
          We could not verify fresh location and forecast data for this page.
          No unverified weather values are being displayed.
        </p>
        <div className="error-actions">
          <button type="button" onClick={reset}>Try again</button>
          <Link href="/">Search another location</Link>
        </div>
      </section>
    </main>
  );
}
