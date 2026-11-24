# Weathercast

A non-commercial, ad-free, Philippines-first weather companion built in reviewed phases.

## Phase 1

This phase provides a minimal Next.js scaffold and a server-only AI provider abstraction. It intentionally has no weather fetching, public AI endpoint, city search, caching, rate limiting, PAGASA integration, or finished dashboard UI. AI library code is not reachable from the page or any HTTP entry point.

Fresh implementation from `main`; unrelated to closed PR #1.

## Requirements

- Node.js 20.9 or newer
- npm
- Gemini API key for the primary provider
- Optional Groq API key for fallback only

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. `GROQ_API_KEY` is optional. `AI_PROVIDER` defaults to `gemini`; unsupported values are rejected. Groq is never promoted to primary.

## Commands

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run check:build` (after a successful build)

## Privacy

The AI layer sends only a location label, allowlisted weather values, and the user's question/context. It does not accept latitude/longitude fields. Free-text coordinate redaction is best-effort and cannot reliably remove every address, landmark, Plus Code, what3words reference, written-out coordinate, or obfuscated location. Do not include personal or sensitive information in questions.

Gemini free-tier requests may be used by Google to improve its products. If Groq fallback is enabled, eligible failures can send the same minimized request to Groq. Review each provider's current terms and privacy settings before using real personal data. API keys remain server-side and are never logged.

Weathercast does not claim AI explanations are official forecasts or alerts. Future phases must display provider weather data separately from AI-generated explanations and must not let AI invent weather measurements or warnings.

## Model selection

The implementation uses Gemini model `gemini-2.5-flash-lite` and Groq model `openai/gpt-oss-20b`, checked against provider documentation on 2026-11-24. Free-tier availability, quotas, geographic availability, and no-card requirements can change and are not guaranteed. No live provider call has been performed as part of this phase.

## Attribution

Open-Meteo weather integration is not part of Phase 1. When added, its required attribution and non-commercial terms must be respected.
