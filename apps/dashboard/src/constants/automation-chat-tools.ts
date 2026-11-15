export const AUTOMATION_CHAT_TOOL_NAMES = {
  list: "listAutomations",
  updateSchedule: "updateSchedule",
  runSchedule: "runScheduleNow",
  createEventTrigger: "createEventTrigger",
  updateEventTrigger: "updateEventTrigger",
  createGeoAlert: "createGeoAlert",
  updateGeoAlert: "updateGeoAlert",
  testGeoAlert: "sendTestGeoAlert",
  setEnabled: "setAutomationEnabled",
  delete: "deleteAutomation",
} as const;

/** Every tool that changes an automation, sends something or spends credits. */
export const AUTOMATION_CHAT_APPROVAL_TOOL_NAMES: readonly string[] = [
  AUTOMATION_CHAT_TOOL_NAMES.updateSchedule,
  AUTOMATION_CHAT_TOOL_NAMES.runSchedule,
  AUTOMATION_CHAT_TOOL_NAMES.createEventTrigger,
  AUTOMATION_CHAT_TOOL_NAMES.updateEventTrigger,
  AUTOMATION_CHAT_TOOL_NAMES.createGeoAlert,
  AUTOMATION_CHAT_TOOL_NAMES.updateGeoAlert,
  AUTOMATION_CHAT_TOOL_NAMES.testGeoAlert,
  AUTOMATION_CHAT_TOOL_NAMES.setEnabled,
  AUTOMATION_CHAT_TOOL_NAMES.delete,
];

export const AUTOMATION_CHAT_UNTITLED_SCHEDULE = "Untitled schedule";

export const AUTOMATION_CHAT_DESCRIPTION =
  "**Automations**: Everything on the Automations page. createSchedule drafts content on a cadence; createEventTrigger drafts it when a GitHub release or push happens; createGeoAlert sends a Slack, email or webhook alert when AI visibility changes. listAutomations shows all three with their ids; change them with updateSchedule, updateEventTrigger or updateGeoAlert, pause or resume any of them with setAutomationEnabled, start a schedule now with runScheduleNow, try an alert with sendTestGeoAlert, and remove one with deleteAutomation. Call listAutomations before changing or deleting one, and never guess an id. The user approves each change in the chat, so call the tool directly instead of asking for permission first.";
