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

## TypeScript path aliases

The `baseUrl` compiler option in `tsconfig.json` defines the base directory for resolving non-relative module imports. With `baseUrl: "."`, the `@/*` path mapping resolves imports such as `@/components/WeatherDashboard` to files under `src/*`.

The option is valid and supported, including with the project's TypeScript and Next.js configuration. It is not required to remove it for the current build. If `baseUrl` is removed later, the `paths` entries may remain because TypeScript resolves them relative to `tsconfig.json`, but path-alias configuration should be changed and verified as one unit.

## API response age and weather valid time

The implementation keeps two different timestamps separate:

- Open-Meteo `current.time` is the **valid time**: the moment at which the current weather values apply. It is displayed as “Valid time” and is not used to calculate age.
- The `Date` HTTP response header is parsed and stored as `sourceResponseTime`. RFC 9110 defines this header as the origination time of the HTTP message. The UI uses it only to calculate **how old the Open-Meteo API response is**, not how old the underlying weather-model run is.

The Open-Meteo Best Match Forecast API does not identify the model run used for each location in its documented response. Open-Meteo's model metadata page also warns that per-model update times do not directly correlate with Forecast API updates because Best Match automatically selects a model for each location. Therefore Weathercast does not claim to know the selected model's initialization age.

The response-age policy is:
- Up to 60 minutes: recent API response.
- 61–90 minutes: visibly aged API response.
- More than 90 minutes: suppress the current-conditions panel.
- More than six hours: suppress hourly and daily forecast panels.
- Missing, invalid, or substantially future-dated HTTP `Date` header: response age is unknown, so current and forecast values are hidden rather than labelled recent.

The browser recalculates response age every minute. Next.js Data Cache and the page's ISR cache retain/reuse the response data; the original response timestamp must age with that cached data rather than being replaced by the page-render time. Verify this behavior on the protected Preview before relying on it operationally.

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


## Dependency security audit and toolchain resolution (updated November 25, 2026)

The original committed lockfile was audited using `npm audit --json` in GitHub Actions and reported three advisories in the development/test dependency tree. No production dependency advisories were reported.

Following Owner approval, Vitest was upgraded from `3.2.7` to `4.1.12`, and `package-lock.json` was regenerated using npm rather than manually edited.

The regenerated lockfile was inspected with Node.js `v22.23.5`. The resolved versions recorded in that inspection are:

| Package | Resolved version | Dependency role |
|---|---:|---|
| Next.js | `16.4.6` | Production |
| React | `19.3.1` | Production |
| React DOM | `19.3.1` | Production |
| TypeScript | `5.9.3` | Development/build tooling |
| Vitest | `4.1.12` | Development/test tooling |
| Vite | `8.3.8` | Development/test tooling; transitive through Vitest and `@vitest/mocker` |

The regenerated development/test toolchain also resolves Rolldown `1.2.19` and LightningCSS `1.33.0`, along with `@oxc-project/types`, `es-module-lexer`, `obug`, and platform-specific optional packages. Dependency-chain inspection attributed these additions to the Vite/Vitest toolchain. The review found **zero changed package records that could not be shown to belong to the development/test dependency tree**. The Vite change from `7.3.8` to `8.3.8` is therefore recorded as a development/test-toolchain resolution change, not as a production dependency update. The reviewed production versions listed above remain unchanged.

Compatibility and verification notes:

- The package's Node.js engine requirement is `22.x`.
- Node.js `v22.23.5` was used for the read-only lockfile inspection. An earlier shell check reported Node.js `v24.22.2` and npm `11.19.1`; the available records do not establish the exact Node.js runtime used for every local install, test, and build command.
- The Owner reported that clean `npm ci`, `npm audit`, ESLint, TypeScript typecheck, Vitest tests, production build, and `git diff --check` passed against the local working changes.
- The regenerated lockfile's `npm audit --json` result was **0 vulnerabilities** (0 info, low, moderate, high, or critical) across 466 dependencies, including production and development dependencies.
- These are local results reported by the Owner, not an independently reproduced run. CI on the final pushed branch head remains required, including Linux platform-specific optional-package installation and the full test/build checks. The protected Vercel Preview verification also remains a separate required gate; do not describe either pending check as passed.

The previous audit findings are not considered resolved solely on the basis of the Vitest upgrade or successful build checks; the zero-vulnerability audit result for the regenerated lockfile is the verification. `npm audit fix --force` was not used. The existing Dependabot upgrade was not manually altered as part of this change and may need review against the final lockfile/PR state.

The CI production build runs with synthetic, non-production sentinel values assigned to `GEMINI_API_KEY`, `GROQ_API_KEY`, and `TURNSTILE_SECRET_KEY`. The build's postbuild boundary scan therefore checks whether those literal values entered the actual `.next/static` or `.next/server` output. CI then runs the boundary checker once more with the same synthetic values. This does not expose real provider credentials or require AI keys for the weather dashboard.
