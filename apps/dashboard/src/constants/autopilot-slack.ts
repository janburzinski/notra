import { SLACK_API_BASE_URL } from "@notra/ai/constants/slack";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";

export const AUTOPILOT_SLACK_POST_MESSAGE_URL = `${SLACK_API_BASE_URL}/chat.postMessage`;

export const AUTOPILOT_SLACK_CHANNEL_HINT =
  "Invite the Notra app to this channel so it can send the daily brief.";

export const AUTOPILOT_SLACK_KIND_LABELS: Record<AutopilotJobKind, string> = {
  readiness: "Agent readiness",
  keywords: "Blog post for a keyword",
  commits: "Blog post from your recent work",
  prompts: "Tracked prompts",
  competitors: "Competitors",
};
