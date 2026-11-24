import os
from typing import Any
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

load_dotenv()
app = FastAPI(title="Weathercast AI API", version="0.1.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"])

class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    location: dict[str, Any]
    weather: dict[str, Any]

@app.get("/health")
async def health():
    return {"status": "ok", "service": "weathercast-ai"}

@app.post("/api/assistant")
async def assistant(payload: AssistantRequest):
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="AI is not configured. Add OPENAI_API_KEY to the backend environment.")
    context = {
        "location": payload.location.get("name", "selected location"),
        "country": payload.location.get("country"),
        "current": payload.weather.get("current", {}),
        "next_24_hours": {
            "time": payload.weather.get("hourly", {}).get("time", [])[:24],
            "temperature_c": payload.weather.get("hourly", {}).get("temperature_2m", [])[:24],
            "precipitation_probability_percent": payload.weather.get("hourly", {}).get("precipitation_probability", [])[:24],
            "weather_code": payload.weather.get("hourly", {}).get("weather_code", [])[:24],
        },
        "daily": {k: v[:7] for k, v in payload.weather.get("daily", {}).items() if isinstance(v, list)},
    }
    instructions = (
        "You are Weathercast AI, a careful weather explainer and planning assistant. Answer in the "
        "same language as the user's question. Use only supplied weather data; never invent forecasts, "
        "alerts, observations, or probabilities. Distinguish model forecast from certainty and explain "
        "uncertainty plainly. For safety-sensitive questions, recommend official national/local "
        "meteorological agencies and emergency authorities. Never claim to issue official warnings. "
        "Be concise and practical. Temperatures are Celsius and wind speed is km/h."
    )
    try:
        client = AsyncOpenAI(api_key=key)
        response = await client.responses.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            instructions=instructions,
            input="User question: " + payload.question + "\nWeather data (JSON): " + str(context),
        )
        answer = response.output_text.strip()
        if not answer:
            raise HTTPException(status_code=502, detail="The AI returned an empty response.")
        return {"answer": answer, "location": context["location"]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The AI service is temporarily unavailable.") from exc
