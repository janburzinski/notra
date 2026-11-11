import { DateTime, Option } from "effect";

import type { AutopilotSchedule } from "@/types/autopilot-runtime";

export function autopilotLocalParts(
  date: Date,
  formatter: Intl.DateTimeFormat
) {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

export function autopilotLocalFormatter(timezone: string) {
  const options = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  } as const;
  try {
    return new Intl.DateTimeFormat("en-CA", options);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
  }
}

/** Earlier manual or onboarding runs don't replace today's scheduled brief. */
export function isAutopilotDue(settings: AutopilotSchedule, now: Date) {
  const formatter = autopilotLocalFormatter(settings.timezone);
  const current = autopilotLocalParts(now, formatter);
  if (current.hour < settings.briefHour) {
    return false;
  }
  if (!settings.lastRunAt) {
    return true;
  }
  const last = autopilotLocalParts(settings.lastRunAt, formatter);
  return last.day !== current.day || last.hour < settings.briefHour;
}

export function autopilotLocalDayStart(timezone: string, now: Date) {
  const zone = Option.getOrElse(DateTime.zoneMakeNamed(timezone), () =>
    DateTime.zoneMakeOffset(0)
  );
  const zoned = DateTime.setZone(DateTime.makeUnsafe(now), zone);
  return new Date(DateTime.toEpochMillis(DateTime.startOf(zoned, "day")));
}
