import { notFound } from "next/navigation";
import Link from "next/link";
import { LocationSearch } from "@/components/LocationSearch";
import { WeatherDashboard } from "@/components/WeatherDashboard";
import { getPhilippineForecast } from "@/lib/weather/forecast";
import { getResponseAgeMinutes } from "@/lib/weather/freshness";
import { resolvePhilippineLocation } from "@/lib/weather/geocoding";
import type { LocationSearchItem } from "@/lib/weather/types";

export const revalidate = 600;

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  // Unknown GeoNames IDs are generated on demand and then served through ISR.
  return [];
}

function toPublicLocation(location: {
  id: number;
  name: string;
  admin1: string | null;
  country: string;
  countryCode: "PH";
  timezone: string;
}): LocationSearchItem {
  return {
    id: location.id,
    name: location.name,
    admin1: location.admin1,
    country: location.country,
    countryCode: location.countryCode,
    timezone: location.timezone,
  };
}

function PageHeader() {
  return (
    <header className="weather-topbar">
      <Link className="brand brand-small" href="/" aria-label="Weathercast home">
        <span className="brand-mark" aria-hidden="true">W</span>
        <span>weathercast</span>
      </Link>
      <div className="page-search"><LocationSearch /></div>
    </header>
  );
}

export default async function WeatherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  if (!/^[1-9]\d{0,9}$/.test(rawId)) notFound();

  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) notFound();

  const locationResult = await resolvePhilippineLocation(id);
  if (!locationResult.ok) {
    if (locationResult.error.code === "not_found") notFound();
    throw new Error("Unable to verify the selected Philippine location.");
  }

  const location = locationResult.value;
  const forecastResult = await getPhilippineForecast(location);
  if (!forecastResult.ok) {
    throw new Error("Weather data is temporarily unavailable. Please retry.");
  }

  const forecast = forecastResult.value;
  return (
    <>
      <PageHeader />
      <WeatherDashboard
        location={toPublicLocation(location)}
        forecast={forecast}
        initialAgeMinutes={getResponseAgeMinutes(forecast.sourceResponseTime)}
      />
    </>
  );
}
