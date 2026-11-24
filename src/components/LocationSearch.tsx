"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationSearchItem } from "@/lib/weather/types";

type SearchResponse = {
  locations?: unknown;
  error?: unknown;
};

function isLocationSearchItem(value: unknown): value is LocationSearchItem {
  if (!value || typeof value !== "object") return false;
  const location = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(location.id) &&
    typeof location.name === "string" &&
    (location.admin1 === null || typeof location.admin1 === "string") &&
    typeof location.country === "string" &&
    location.countryCode === "PH" &&
    typeof location.timezone === "string"
  );
}

export function LocationSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<LocationSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const normalized = query.trim();

    if (normalized.length < 2) {
      setLocations([]);
      setLoading(false);
      setError("");
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/locations?q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );

        const payload: SearchResponse = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "Location search is temporarily unavailable.",
          );
        }

        if (!Array.isArray(payload.locations)) {
          throw new Error("The location search returned an invalid response.");
        }

        const valid = payload.locations.filter(isLocationSearchItem);
        setLocations(valid.slice(0, 8));
        setOpen(true);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setLocations([]);
        setOpen(true);
        setError(
          caught instanceof Error
            ? caught.message
            : "Location search is temporarily unavailable.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function selectLocation(location: LocationSearchItem) {
    setOpen(false);
    setQuery("");
    router.push(`/weather/${location.id}`);
  }

  return (
    <div className="location-search">
      <label className="sr-only" htmlFor="location-search-input">
        Search Philippine cities and towns
      </label>
      <div className="search-field">
        <span className="search-symbol" aria-hidden="true">⌕</span>
        <input
          id="location-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          placeholder="Search a city or town in the Philippines"
          autoComplete="off"
          maxLength={80}
          aria-autocomplete="list"
          aria-controls="location-search-options"
          aria-expanded={open && locations.length > 0}
        />
        {loading ? <span className="search-state">Searching…</span> : null}
      </div>

      {open && (locations.length > 0 || error || (!loading && query.trim().length >= 2)) ? (
        <div
          id="location-search-options"
          className="search-results"
          role="listbox"
          aria-label="Philippine locations"
        >
          {error ? <p className="search-message" role="status">{error}</p> : null}
          {!error && !loading && locations.length === 0 ? (
            <p className="search-message" role="status">No matching Philippine locations found.</p>
          ) : null}
          {locations.map((location) => (
            <button
              className="search-option"
              type="button"
              role="option"
              aria-selected="false"
              key={location.id}
              onClick={() => selectLocation(location)}
            >
              <span className="search-option-name">{location.name}</span>
              <span className="search-option-place">
                {[location.admin1, location.country].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
