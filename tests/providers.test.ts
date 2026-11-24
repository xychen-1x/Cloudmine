import { afterEach, describe, expect, it, vi } from "vitest";
import { createGeminiProvider } from "../src/lib/ai/providers/gemini";
import { createGroqProvider } from "../src/lib/ai/providers/groq";
import { classifyHttp } from "../src/lib/ai/providers/shared";

const input = { systemPrompt: "system", userPrompt: "weather question" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gemini provider", () => {
  it("sends the API key in a server-side header and forwards the abort signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Rain is possible." }] }, finishReason: "STOP" }],
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createGeminiProvider("test-secret").generate(input, controller.signal);
    expect(result).toMatchObject({ ok: true, value: { text: "Rain is possible.", finishReason: "stop" } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("test-secret");
    expect(init.signal).toBe(controller.signal);
    expect(String(init.body)).toContain("weather question");
  });
});

describe("Groq provider", () => {
  it("sends a bearer credential and forwards the abort signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify({
        choices: [{ message: { content: "Cloudy later." }, finish_reason: "stop" }],
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createGroqProvider("test-secret").generate(input, controller.signal);
    expect(result).toMatchObject({ ok: true, value: { text: "Cloudy later.", finishReason: "stop" } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-secret");
    expect(init.signal).toBe(controller.signal);
    expect(String(init.body)).toContain("weather question");
  });
});

describe("provider HTTP classification", () => {
  it("keeps rate limits and server errors fallback-eligible", () => {
    expect(classifyHttp(429, "gemini").code).toBe("rate_limited");
    expect(classifyHttp(503, "gemini").code).toBe("provider_unavailable");
  });

  it("does not treat credential, request, or safety failures as retryable", () => {
    expect(classifyHttp(401, "gemini").retryable).toBe(false);
    expect(classifyHttp(400, "groq").retryable).toBe(false);
  });
});
