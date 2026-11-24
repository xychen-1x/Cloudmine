# Weathercast

AI-assisted weather dashboard with live conditions, a 7-day forecast, model-based indicators, and a context-aware AI assistant.

## Stack
- Frontend: Next.js, React, TypeScript
- Weather: Open-Meteo Forecast and Geocoding APIs
- AI backend: FastAPI + OpenAI Responses API
- Hosting target: Vercel (frontend), Fly.io (API)

## Run locally
Frontend: run `npm install`, copy `.env.example` to `.env.local`, then `npm run dev`.

Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY="your-key"
export CORS_ORIGINS="http://localhost:3000"
uvicorn app.main:app --reload --port 8000
```
Set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 in the frontend .env.local.

## Deployment
1. Import the repository root into Vercel for the Next.js frontend.
2. Deploy the backend directory to Fly.io using its Dockerfile.
3. Set OPENAI_API_KEY, OPENAI_MODEL, and CORS_ORIGINS on the backend.
4. Set NEXT_PUBLIC_API_BASE_URL in Vercel to the backend URL and redeploy.

## Forecast safety
Weather values are sourced from Open-Meteo. Dashboard risk indicators are simple heuristics, not calibrated hazard models or official alerts. AI explains supplied forecast data; it does not independently forecast weather. Follow official meteorological and emergency authorities for warnings and urgent decisions.

## Planned next steps
- Official agency alert feed and source attribution.
- Forecast confidence and numerical-model comparison.
- Validation dataset and evaluation before introducing custom prediction models.
- LangGraph workflows when multi-step tools and stateful agent behavior are justified.
