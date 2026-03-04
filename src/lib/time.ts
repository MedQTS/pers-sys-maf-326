// src/lib/time.ts
// Canonical UI formatting for AET (Australia/Melbourne).
// Notes:
// - Input is expected to be an ISO string representing a real UTC instant (timestamptz).
// - Output includes the correct local abbreviation (AEST or AEDT) based on DST.

export type AETFormatStyle = "datetime" | "date" | "time";

const TZ = "Australia/Melbourne";
const LOCALE = "en-AU";

/** Returns "AEST" or "AEDT" for the given UTC instant. */
export function aetTzAbbrev(isoUtc: string): "AEST" | "AEDT" | "AET" {
  try {
    const d = new Date(isoUtc);
    if (Number.isNaN(d.getTime())) return "AET";

    const parts = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      timeZoneName: "short",
    }).formatToParts(d);

    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    if (tzName.includes("AEDT")) return "AEDT";
    if (tzName.includes("AEST")) return "AEST";
    return "AET";
  } catch {
    return "AET";
  }
}

/** Formats a UTC ISO timestamp for display in Australia/Melbourne. */
export function formatAET(
  isoUtc: string | null | undefined,
  style: AETFormatStyle = "datetime"
) {
  if (!isoUtc) return "—";
  try {
    const d = new Date(isoUtc);
    if (Number.isNaN(d.getTime())) return "—";

    const tz = aetTzAbbrev(isoUtc);

    if (style === "date") {
      const date = new Intl.DateTimeFormat(LOCALE, {
        timeZone: TZ,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
      return `${date} ${tz}`;
    }

    if (style === "time") {
      const time = new Intl.DateTimeFormat(LOCALE, {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(d);
      return `${time} ${tz}`;
    }

    // datetime
    const dt = new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);

    return `${dt} ${tz}`;
  } catch {
    return "—";
  }
}

/** Use for sorting in UI; returns epoch ms or null. */
export function aetEpochMs(isoUtc: string | null | undefined): number | null {
  if (!isoUtc) return null;
  const d = new Date(isoUtc);
  const ms = d.getTime();
  return Number.isNaN(ms) ? null : ms;
}
