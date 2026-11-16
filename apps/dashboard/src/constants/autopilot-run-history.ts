import type { AutopilotRunDayState } from "@/types/autopilot-metrics";

/**
 * What a run logs for an automation that is switched off. The run history
 * leaves these days out, so a job turned on later doesn't look like it ran.
 */
export const AUTOPILOT_JOB_OFF_MESSAGE = "Turned off in settings";

/** Days the automations table draws, one bar each, today last. */
export const AUTOPILOT_RUN_HISTORY_DAYS = 14;

/** A pull request is the day that counts; a failure the day to look at. */
export const AUTOPILOT_RUN_DAY_CLASS: Record<AutopilotRunDayState, string> = {
  opened: "h-5.5 bg-success",
  failed: "h-5.5 bg-destructive",
  ran: "h-0.75 bg-muted-foreground/35",
  idle: "h-0.75 bg-muted-foreground/15",
};

/** What a day's bar says on hover. */
export const AUTOPILOT_RUN_DAY_LABELS: Record<AutopilotRunDayState, string> = {
  opened: "Opened a pull request",
  failed: "Failed",
  ran: "Ran, nothing new",
  idle: "Didn't run",
};
