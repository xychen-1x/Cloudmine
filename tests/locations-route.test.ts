import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/locations/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/locations", () => {
  it("rejects short, overlong, and unsafe queries before contacting Open-Meteo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const short = await GET(new Request("https://weathercast.test/api/locations?q=M"));
    const unsafe = await GET(new Request("https://weathercast.test/api/locations?q=Manila%3Cscript%3E"));
    const long = await GET(new Request(
      "https://weathercast.test/api/locations?q=" + "M".repeat(81),
    ));

    expect(short.status).toBe(400);
    expect(unsafe.status).toBe(400);
    expect(long.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a private no-store response with validated Philippine locations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [
        {
          id: 1701668,
          name: "Manila",
          latitude: 14.5995,
          longitude: 120.9842,
          country: "Philippines",
          country_code: "PH",
          admin1: "Metro Manila",
          timezone: "Asia/Manila",
        },
        {
          id: 123,
          name: "Foreign city",
          latitude: 1,
          longitude: 1,
          country: "Elsewhere",
          country_code: "XX",
          timezone: "Asia/Manila",
        },
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://weathercast.test/api/locations?q=Manila"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(payload.locations).toHaveLength(1);
    expect(payload.locations[0]).toMatchObject({
      id: 1701668,
      name: "Manila",
      countryCode: "PH",
    });

    const [requestUrl] = fetchMock.mock.calls[0] as [URL];
    expect(requestUrl.searchParams.get("countryCode")).toBe("PH");
    expect(requestUrl.searchParams.get("count")).toBe("8");
  });

  it("returns a clear empty result for a valid query with no matching city", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ results: [] })));

    const response = await GET(new Request("https://weathercast.test/api/locations?q=NoSuchTown"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.locations).toEqual([]);
  });

  it("preserves the upstream 429 retry hint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));

    const response = await GET(new Request("https://weathercast.test/api/locations?q=Manila"));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(typeof payload.error).toBe("string");
  });

  it("maps upstream errors and timeout to safe gateway responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const upstream = await GET(new Request("https://weathercast.test/api/locations?q=Manila"));
    expect(upstream.status).toBe(502);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(
      new DOMException("The request timed out", "TimeoutError"),
    ));
    const timeout = await GET(new Request("https://weathercast.test/api/locations?q=Manila"));
    expect(timeout.status).toBe(504);
  });
});
