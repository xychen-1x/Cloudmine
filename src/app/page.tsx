import Link from "next/link";
import { LocationSearch } from "@/components/LocationSearch";

export default function HomePage() {
  return (
    <main className="home-page">
      <header className="home-topbar">
        <Link className="brand" href="/" aria-label="Weathercast home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>weathercast</span>
        </Link>
        <span className="region-pill">MADE FOR THE PHILIPPINES</span>
      </header>

      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">WEATHER, MADE CLEARER</p>
          <h1>See what the sky<br /><span>has in store.</span></h1>
          <p className="hero-description">
            Explore current conditions and the week ahead for cities and towns across the Philippines.
          </p>
          <LocationSearch />
          <p className="search-hint">Start with at least two letters. Choose a result to open its forecast.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-ring-one" />
          <div className="orbit-ring orbit-ring-two" />
          <div className="orbit-sun">☀</div>
          <div className="orbit-cloud">☁</div>
          <span className="orbit-star orbit-star-one">✦</span>
          <span className="orbit-star orbit-star-two">✧</span>
        </div>
      </section>

      <section className="feature-row" aria-label="Weathercast features">
        <article className="feature-item">
          <span className="feature-icon" aria-hidden="true">◷</span>
          <div><h2>Right now</h2><p>Temperature, feels-like and humidity.</p></div>
        </article>
        <article className="feature-item">
          <span className="feature-icon" aria-hidden="true">☷</span>
          <div><h2>Next 24 hours</h2><p>See hourly temperature and rain chances.</p></div>
        </article>
        <article className="feature-item">
          <span className="feature-icon" aria-hidden="true">▤</span>
          <div><h2>7-day outlook</h2><p>Plan ahead with daily highs and lows.</p></div>
        </article>
      </section>

      <footer className="home-footer">
        <span>Weathercast · Philippines-first · Non-commercial · Ad-free</span>
        <span>Weather data by Open-Meteo · Location data based on GeoNames</span>
      </footer>
    </main>
  );
}
