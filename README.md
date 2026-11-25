# Weathercast

A non-commercial, ad-free, Philippines-first weather dashboard built with Next.js App Router and TypeScript.

## Current Phase 2 features

- Search Philippine cities and towns using Open-Meteo Geocoding (GeoNames location data).
- View model-derived current conditions: temperature, feels-like temperature, humidity and WMO weather description.
- View the next 24 hours: temperature, precipitation probability, precipitation amount and weather description.
- View a seven-day forecast: daily high/low temperature, precipitation probability and weather description.
- Show the Open-Meteo HTTP response age separately from weather valid time; hide current conditions when the response is older than 90 minutes and forecasts when it is older than six hours or the response timestamp cannot be verified.
- Use the Next.js Data Cache for geocoding (24-hour TTL candidate) and forecast data (600 seconds), with an on-demand ISR city page.
- Keep the existing Phase 1 AI provider abstraction isolated. Phase 2 weather routes do not call Gemini or Groq and do not require AI API keys.

## Requirements

- Node.js 22.x
- npm

## Setup

```bash
npm ci
npm run dev
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check:build
```

The build command runs lint, typecheck, unit tests and the production build boundary check through its prebuild/postbuild hooks. The standalone `npm run check:build` command requires a successful `.next` build first.

## Data sources, licence and attribution

- Weather: Open-Meteo standard Forecast API. Weather data is provided under CC BY 4.0; the UI links to Open-Meteo and distinguishes weather valid time from HTTP response age. The Best Match endpoint does not expose the selected model run age.
- Location search: Open-Meteo Geocoding API, which uses GeoNames data. The UI attributes GeoNames.
- The Open-Meteo free/open-access API is for non-commercial use, has a 10,000 equivalent-call daily limit and 300,000 monthly limit, and has no uptime guarantee. Weathercast must remain non-commercial and ad-free under this integration.
- Weathercast Phase 2 does not integrate PAGASA CAP alerts. Open-Meteo model values are not official PAGASA warnings.

## Phase boundaries and AI safety

The Phase 1 AI provider abstraction is retained server-side but is not used by Phase 2 weather pages or the public location-search API. No AI-generated measurements, forecasts or official warnings are permitted.

Future PAGASA or AI explanation integrations require separate planning and Owner approval. Any future AI explanation may only explain supplied, provenance-labeled weather data and must remain separate from weather values and official warnings.

## Privacy and security

No accounts, GPS permission, database, public AI endpoint, advertising or paid API are part of Phase 2. API keys are not required to use the weather dashboard. Do not commit local environment files or provider secrets.

See [docs/PHASE2-OPERATIONS.md](docs/PHASE2-OPERATIONS.md) for cache settings, API request weighting, operational risks and verification requirements.
