# Weathercast Phase 2 — Operational and Verification Notes

**Status:** Implementation notes for approved Phase 2  
**Scope:** P2.0–P2.5 only

## Upstream data and request budget

The standard Open-Meteo Forecast API request uses one Philippine location and seven forecast days with these variables:

| Group | Variables | Count |
|---|---|---:|
| Current | temperature_2m, apparent_temperature, relative_humidity_2m, weather_code | 4 |
| Hourly | temperature_2m, precipitation_probability, precipitation, weather_code | 4 |
| Daily | temperature_2m_max, temperature_2m_min, weather_code, precipitation_probability_max | 4 |
| **Total** |  | **12** |

Open-Meteo's free non-commercial tier counts requests using more than ten weather variables at a fractional equivalent-call weight. With 12 selected variables for one location and seven days, the planned weight is **1.2 equivalent calls per forecast HTTP request**. This is recorded in `src/lib/weather/forecast.ts` and covered by a unit test.

At the target of one forecast HTTP request per city per ten-minute window:
- 100 same-city page views within ten minutes should generate no more than one forecast HTTP request in the tested region.
- That request represents approximately 1.2 equivalent Open-Meteo calls.
- At continuous traffic, one city revalidated six times per hour for 24 hours would represent approximately 172.8 equivalent calls per day. This is a capacity illustration, not a traffic forecast.

Open-Meteo's free tier is non-commercial, capped at 10,000 equivalent calls per day and 300,000 per month, and has no uptime SLA. The project must remain non-commercial and show Open-Meteo attribution. Monitor actual usage rather than treating the cap as a guaranteed operating budget.

Official references:
- https://open-meteo.com/en/pricing
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/geocoding-api

## Cache strategy

The implementation deliberately starts with the Next.js Data Cache via `fetch(..., { next: { revalidate } })`:
- Geocoding search and canonical GeoNames ID lookup: 86,400 seconds.
- Forecast request: 600 seconds.
- The city page is generated on demand and uses a 600-second ISR revalidation interval.
- The dynamic city page uses an empty `generateStaticParams()` result with default dynamic params, so arbitrary valid GeoNames IDs are generated on first request and then cached as ISR paths.
- Vercel request collapsing is expected only for eligible ISR page paths and only within the tested region. It does not apply to the `/api/locations` search handler.

Do not switch to `use cache: remote` or enable Cache Components as part of this implementation. Reconsider only after confirming the exact resolved Next.js version, Vercel Runtime Cache migration status, included usage, and deployment Build ID behavior. A new Next.js build changes the Build ID in `use cache` keys and can cause a cold-cache refill.

The actual Vercel project currently reports region `iad1` for the inspected Preview deployment. Confirm the region and Runtime Cache status again in the dashboard before relying on any regional budget measurement.

Official references:
- https://nextjs.org/docs/app/api-reference/functions/fetch
- https://nextjs.org/docs/app/api-reference/functions/generate-static-params
- https://vercel.com/docs/incremental-static-regeneration/request-collapsing
- https://vercel.com/docs/incremental-static-regeneration

## Freshness and stale-data handling

The UI derives source age from Open-Meteo's `current.time` and the returned IANA timezone. It does not mislabel the page render time or cache read time as the model's data timestamp.

- Up to 60 minutes: fresh.
- 61–90 minutes: visibly delayed.
- More than 90 minutes: suppress the current-conditions panel.
- More than six hours or an unparseable/far-future timestamp: suppress hourly and daily forecast panels.

The displayed model timestamp is local to the selected location. The browser recalculates age every minute so a cached page cannot keep displaying an unchanged freshness badge as time passes. When data is unavailable or too old, the UI says so rather than inventing values.

## Public location-search endpoint risk

`GET /api/locations?q=...` is a public endpoint. Validation, a maximum query length, a Philippines-only upstream filter, a maximum of eight results, and a 24-hour upstream fetch cache reduce ordinary load.

However, different arbitrary query strings can create distinct cache keys. No global $0 rate limiter is currently configured. Any process-local limiter would not be global across serverless instances, so this residual abuse risk is explicitly accepted for Phase 2 and must be reviewed against actual traffic and Open-Meteo usage. Do not claim global rate limiting.

## Rate-limit backoff

The forecast service applies an in-process cooldown after Open-Meteo HTTP 429:
- First 429: 60 seconds.
- Repeated 429 after expiry: 300 seconds.
- Successful response clears that process's cooldown.

This is best-effort protection per warm process, not a distributed/global lock or rate limiter. The Next.js/Vercel ISR path and Data Cache are the primary cache mechanisms; a local Promise map is not treated as cross-instance protection.

## Required Preview verification

Before requesting Owner review:
1. Confirm the branch build passes `npm ci`, lint, typecheck, Vitest, production build, and build-output boundary checks.
2. Confirm the build manifest contains exactly the reviewed `/api/locations/route` API route and no other API routes.
3. Confirm no Server Action references are emitted.
4. Test Philippine queries, empty results, invalid characters, overlong input, upstream 429, timeout, and malformed upstream JSON.
5. Test a valid Philippine GeoNames ID, invalid ID, and a non-Philippine ID.
6. Test current/hourly/daily rendering and all freshness boundaries.
7. Run the 100-view same-city / ten-minute Preview test in the configured region. Record response cache headers and count `forecast_data_loaded`, `forecast_upstream_error`, and `forecast_rate_limited` runtime events carefully; `forecast_data_loaded` is an application event and must not automatically be interpreted as a counted upstream call if the Data Cache served the response.
8. Record Open-Meteo equivalent-call weight, observed requests, Vercel Runtime Cache usage, region, and Preview/Production environment separately.

If Vercel SSO protection prevents an automated Preview test, record that blocker and perform the exact test through an authorized browser/session. Never describe an unexecuted test as passed.
