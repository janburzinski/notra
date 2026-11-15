export const CREATE_ARTIFACT_TOOL_NAME = "createArtifact";
export const UPDATE_ARTIFACT_TOOL_NAME = "updateArtifact";
export const GET_ARTIFACT_TOOL_NAME = "getArtifact";

export const ARTIFACT_SOURCES = ["chat", "slack", "autopilot"] as const;

export const ARTIFACT_PATH = "/artifact";
/** Next to shared chats, so it adds no new top-level path. */
export const ARTIFACT_SHARE_PATH = "/share/artifact";

export const ARTIFACT_ID_LENGTH = 16;
export const ARTIFACT_SHARE_ID_LENGTH = 21;

export const ARTIFACT_LIMITS = {
  title: 120,
  summary: 400,
  blocks: 40,
  blockTitle: 120,
  markdown: 6000,
  metricItems: 6,
  metricLabel: 60,
  metricValue: 40,
  metricNote: 120,
  tableColumns: 8,
  tableRows: 100,
  tableCell: 300,
  calloutText: 1000,
  findingIds: 20,
  sources: 20,
  sourceTitle: 200,
  /** Versions listed in the picker; older ones stay stored. */
  versionsListed: 50,
} as const;

export const ARTIFACT_CALLOUT_TONES = [
  "info",
  "success",
  "warning",
  "danger",
] as const;

export const ARTIFACT_METRIC_TRENDS = ["up", "down", "flat"] as const;
