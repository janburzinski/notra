import type { NotificationSettingKey } from "@/types/workflows/content-generation-steps";

/**
 * Notifications that are on for an organization that never saved its
 * notification settings. Everything else is off until an owner turns it on.
 */
export const NOTIFICATIONS_ON_WITHOUT_SETTINGS: readonly NotificationSettingKey[] =
  ["autopilotDrafts"];
