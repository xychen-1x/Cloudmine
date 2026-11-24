export function getSourceAgeMinutes(
  localDateTime: string,
  timeZone: string,
  now = Date.now(),
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localDateTime);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");

  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour > 23 || minute > 59 || second > 59
  ) return null;

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(wallClockAsUtc));

    const values = new Map(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(values.get("year")),
      Number(values.get("month")) - 1,
      Number(values.get("day")),
      Number(values.get("hour")),
      Number(values.get("minute")),
      Number(values.get("second")),
    );
    const offsetMs = representedAsUtc - wallClockAsUtc;
    const sourceEpoch = wallClockAsUtc - offsetMs;
    const age = (now - sourceEpoch) / 60_000;

    if (!Number.isFinite(age) || age < -15) return null;
    return Math.max(0, Math.floor(age));
  } catch {
    return null;
  }
}

export type FreshnessState = "fresh" | "stale" | "expired" | "unknown";

export function getFreshnessState(ageMinutes: number | null): FreshnessState {
  if (ageMinutes === null) return "unknown";
  if (ageMinutes <= 60) return "fresh";
  if (ageMinutes <= 90) return "stale";
  return "expired";
}
