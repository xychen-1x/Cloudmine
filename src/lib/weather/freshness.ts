export function getResponseAgeMinutes(
  sourceResponseTime: string | null,
  now = Date.now(),
): number | null {
  if (!sourceResponseTime) return null;

  const sourceEpoch = Date.parse(sourceResponseTime);
  if (!Number.isFinite(sourceEpoch)) return null;

  const age = (now - sourceEpoch) / 60_000;
  // Allow a small clock-skew margin, but never label a substantially future
  // response timestamp as recent.
  if (!Number.isFinite(age) || age < -15) return null;

  return Math.max(0, Math.floor(age));
}

export type FreshnessState = "fresh" | "stale" | "expired" | "unknown";

export function getFreshnessState(ageMinutes: number | null): FreshnessState {
  if (ageMinutes === null) return "unknown";
  if (ageMinutes <= 60) return "fresh";
  if (ageMinutes <= 90) return "stale";
  return "expired";
}
