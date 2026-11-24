import { searchPhilippineLocations } from "@/lib/weather/geocoding";

const PRIVATE_NO_STORE = {
  "Cache-Control": "private, no-store",
};

function jsonError(message: string, status: number, retryAfterSeconds?: number): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        ...PRIVATE_NO_STORE,
        ...(retryAfterSeconds === undefined
          ? {}
          : { "Retry-After": String(retryAfterSeconds) }),
      },
    },
  );
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (
    query.length < 2 ||
    query.length > 80 ||
    /[^\p{L}\p{M}\p{N}\s.'’()/-]/u.test(query)
  ) {
    return jsonError("Enter a location name between 2 and 80 characters.", 400);
  }

  const result = await searchPhilippineLocations(query);
  if (!result.ok) {
    if (result.error.code === "rate_limited") {
      return jsonError(result.error.message, 429, result.error.retryAfterSeconds ?? 60);
    }
    if (result.error.code === "timeout") {
      return jsonError(result.error.message, 504);
    }
    return jsonError(result.error.message, 502);
  }

  return Response.json(
    { locations: result.value },
    { headers: PRIVATE_NO_STORE },
  );
}
