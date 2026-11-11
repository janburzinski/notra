export const AUTOPILOT_AGENT_TIMEOUT_MS = 60_000;

export const AUTOPILOT_TOOL_DESCRIPTIONS = {
  status:
    "Read this workspace's Autopilot state: whether it is on, brief hour and timezone, which automations are on, running runs (with runId), custom workflows, open findings, findings linked in this Slack thread, and rules (with ruleId). Also says whether the requester can change Autopilot. Call this first to resolve ids before acting; never guess an id.",
  updateSettings:
    "Change Autopilot settings: pause or resume Autopilot (enabled), move the daily brief (briefHour 0-23, timezone), or turn automations on or off (jobs). Only send the fields that change. Owner or admin only. Pausing or turning an automation off asks the requester to confirm.",
  run: "Start Autopilot now: the whole daily run, or one automation with kind. Owner or admin only. Returns the runId and whether a run was already going.",
  stop: "Stop a running Autopilot run or custom workflow run by runId from get_autopilot_status. Owner or admin only. Asks the requester to confirm.",
  finding:
    "Act on one Autopilot finding. write: write a saved idea now (it opens a pull request later). dismiss: drop an idea or close its pull request; pass the user's reason so Autopilot learns from it (\"let's not do this\" means dismiss with their words as reason). merge: merge its pull request. Owner or admin only. Dismiss and merge ask the requester to confirm.",
  addRule:
    "Add a standing Autopilot rule, for example 'Never write about pricing' or 'Prefer tutorials over announcements'. Use for lasting preferences, not for one finding. Owner or admin only.",
  deleteRule:
    "Remove an Autopilot rule by ruleId from get_autopilot_status. Owner or admin only. Asks the requester to confirm.",
  setWorkflow:
    "Turn a custom Autopilot workflow on or off by workflowId from get_autopilot_status. Owner or admin only. Turning one off asks the requester to confirm.",
  runWorkflow:
    "Run a custom Autopilot workflow now by workflowId from get_autopilot_status. Owner or admin only. Rate limited per person.",
} as const;
