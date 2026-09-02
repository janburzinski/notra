import type { OpencodeMcpServer } from "@notra/ui/types/brainless-opencode";

export interface OpencodeStoryActivity {
  id: string;
  kind: "thought" | "tool";
  label: string;
  detail?: string;
  duration?: string;
}

export interface OpencodeStorySession {
  title: string;
  userMessage: string;
  assistantMessage: string;
  activities: OpencodeStoryActivity[];
  resultMessage: string;
  promptPlaceholder: string;
  cwd: string;
  context: string;
  tokens: string;
  used: string;
  servers: OpencodeMcpServer[];
}
