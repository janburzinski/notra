export interface DashboardAgentChatProps {
  hasOpened: boolean;
  organizationId: string;
  organizationSlug: string;
  onClose: () => void;
}

export interface UseDashboardAgentChatOptions {
  organizationId: string;
  /** Load the thread list, once the conversation is on screen. */
  loadSessions: boolean;
  /** The Autopilot workflow whose page the user is on. */
  autopilotWorkflowId?: string;
  /** The built-in Autopilot automation whose page the user is on. */
  autopilotAutomation?: string;
}
