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

## Preview verification status (updated November 25, 2026)

### CI and build-boundary checks

For head commit `446d1aa27dad758d3a2bc3adc9f8af94eab9c8d6` on `phase-2/weather-dashboard`, both the GitHub Actions push run (`45606894074`) and pull-request run (`45606903042`) completed successfully.

The final CI run used Node.js `v22.23.5` and verified:
1. `npm ci` completed.
2. Full `npm audit` reported **0 vulnerabilities** across production and development dependencies.
3. ESLint passed.
4. TypeScript typecheck passed.
5. Vitest passed: **49 tests across 8 files**.
6. The production build with synthetic, non-production secret fixtures passed.
7. The post-build boundary scan passed. It checks the build manifest for the reviewed `/api/locations/route` route and rejects unreviewed API routes, checks that no Server Action references are emitted, rejects AI sentinel values in build output, rejects configured secret values in server/client output, and scans in-root build symlinks safely.

The generated Next.js `next-env.d.ts` file is ignored rather than committed. This avoids a clean-checkout CI failure caused by generated `.next/types` references that do not exist before a build.

### Functional tests and Owner smoke test

Automated tests cover Philippine-only geocoding and ID validation, malformed/invalid location data, empty search results, unsafe and overlong search input, upstream errors, 429 handling, timeout handling, forecast request construction, data validation, response-age thresholds, and WMO weather-code mapping.

The Owner manually confirmed that the Preview weather flow works, including Philippine city selection and the current/forecast display. This was a smoke test, not exhaustive browser, accessibility, uptime, or load testing.

### Same-city Preview cache/load test

Date: November 25, 2026  
Preview deployment: `dpl_EpbsheEgesepV8uePSvJyegoXe21`  
URL: https://cloudmine-8wkc1oup9-xychen.vercel.app  
Deployment commit: `446d1aa27dad758d3a2bc3adc9f8af94eab9c8d6`  
Region: `iad1`  
Route: `/weather/1717512` (Cebu City)

The cold route request returned HTTP 200, rendered Cebu City, and was marked `x-vercel-cache: MISS`. The corresponding Preview runtime query recorded one `forecast_data_loaded` event for location ID `1717512` (117 ms).

Two 100-attempt request batches were then sent to the same city URL within the 10-minute forecast revalidation window:
- First burst (10 concurrent workers): 72 requests returned HTTP 200 with `x-vercel-cache: HIT`; 28 were rejected with HTTP 403.
- Lower-rate retry (approximately one request per second): 32 requests returned HTTP 200 with `x-vercel-cache: HIT`; 68 were rejected with HTTP 403.

Therefore, **104 successful same-route HTTP 200 responses were observed, and all 104 were cache hits**. These are successful HTTP requests, not 104 unique people or sessions. The initial cold MISS is additional to those 104 cache hits.

The 403 responses were rejected by the Vercel Deployment Protection/access layer and did not appear as application route executions in the runtime logs. They are not counted as successful views and are not evidence of an application/weather API failure. Deployment Protection was not disabled or reconfigured.

**What this proves:** In the tested `iad1` Preview region, the same city ISR page can serve at least 100 successful repeat requests as Vercel cache hits within the 10-minute window, without repeated page generation being observed in application runtime logs.

**What this does not prove:** The application log `forecast_data_loaded` is not an upstream Open-Meteo billing counter; it may run when Next.js Data Cache supplies a cached fetch result. The exact number of upstream Open-Meteo HTTP requests was not independently measured. This test also does not establish cross-instance, cross-region, or global cache behavior. Do not describe the result as proof of exactly one upstream API request.

The temporary Vercel Sandbox used for this test was stopped and deleted. A temporary Vercel share link was used to authenticate access to the protected Preview; it expires automatically. No project setting or deployment protection policy was changed.

### Current Preview deployment reference

- Deployment ID: `dpl_EpbsheEgesepV8uePSvJyegoXe21`
- URL: https://cloudmine-8wkc1oup9-xychen.vercel.app
- State: **READY**
- Environment: Preview (not Production)
- Branch/commit: `phase-2/weather-dashboard` / `446d1aa27dad758d3a2bc3adc9f8af94eab9c8d6`
- Region: `iad1`

This is the preserved reference deployment for final Phase 2 review. Do not trigger another deployment solely to repeat already-passed checks. Any final documentation commit may cause the Git-connected Preview workflow to create a new Preview; verify its status before replacing this reference.

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
- Node.js `v22.23.5` was used for the read-only lockfile inspection and for the final GitHub Actions CI run.
- The final GitHub Actions runs independently verified clean `npm ci`, full `npm audit`, ESLint, TypeScript typecheck, Vitest, production build, and build-output boundary checks on the pushed branch head.
- The regenerated lockfile's CI `npm audit --json` result was **0 vulnerabilities** (0 info, low, moderate, high, or critical) across production and development dependencies.
- Local results previously reported by the Owner remain useful context, but the final pushed-branch CI results above are the reproducible verification record.

The previous audit findings are considered resolved by the zero-vulnerability audit result for the regenerated lockfile, not merely by the Vitest upgrade or successful build checks. `npm audit fix --force` was not used. The existing Dependabot upgrade should still be reviewed against the final lockfile/PR state before merge.

The CI production build runs with synthetic, non-production sentinel values assigned to `GEMINI_API_KEY`, `GROQ_API_KEY`, and `TURNSTILE_SECRET_KEY`. The build's postbuild boundary scan therefore checks whether those literal values entered the actual `.next/static` or `.next/server` output. CI then runs the boundary checker once more with the same synthetic values. This does not expose real provider credentials or require AI keys for the weather dashboard.
