/** Who changes an automation: the dashboard request or the chat agent. */
export interface AutomationActor {
  organizationId: string;
  userId: string;
  /** Request headers for analytics, when there is a request. */
  headers?: Headers | null;
}

export type AutomationServiceErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "DUPLICATE_TRIGGER"
  | "DUPLICATE_ALERT"
  | "INTEGRATION_NOT_FOUND"
  | "INVALID_DESTINATION_URL"
  | "EVENT_TRIGGERS_ONLY"
  | "MANUAL_RUN"
  | "INTERNAL";
