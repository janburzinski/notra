import type { AutopilotSchedule } from "@/types/autopilot-runtime";

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

function safeTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

/** Earlier manual or onboarding runs don't replace today's scheduled brief. */
export function isAutopilotDue(settings: AutopilotSchedule, now: Date) {
  const timezone = safeTimezone(settings.timezone);
  const current = localParts(now, timezone);
  if (current.hour < settings.briefHour) {
    return false;
  }
  if (!settings.lastRunAt) {
    return true;
  }
  const last = localParts(settings.lastRunAt, timezone);
  return last.day !== current.day || last.hour < settings.briefHour;
}
