import {
  AiBrowserIcon,
  Alert02Icon,
  ChartAnalysisIcon,
  AnalyticsUpIcon,
  Blockchain04Icon,
  ChartHistogramIcon,
  Comment01Icon,
  HelpCircleIcon,
  Mail01Icon,
  News01Icon,
  PaintBoardIcon,
  Sent02Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";

import type { ChatSuggestion } from "@/types/components/chat-suggestions";

export const CHAT_SUGGESTION_ROTATE_MS = 4000;
export const CHAT_SUGGESTION_VISIBLE_COUNT = 3;
export const CHAT_SUGGESTION_SWAP_DISTANCE_PX = 4;
export const CHAT_SUGGESTION_SWAP_BLUR_PX = 2;

export const CHAT_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "blogPost",
    icon: News01Icon,
  },
  {
    id: "releaseNotes",
    icon: Blockchain04Icon,
  },
  {
    id: "socialPost",
    icon: Sent02Icon,
  },
];

export const DASHBOARD_AGENT_SUGGESTIONS: ChatSuggestion[] = [
  ...CHAT_SUGGESTIONS,
  {
    id: "newsletter",
    icon: Mail01Icon,
  },
  {
    id: "comparison",
    icon: AnalyticsUpIcon,
  },
  {
    id: "geoStatus",
    icon: ChartHistogramIcon,
  },
  {
    id: "geoVisibility",
    icon: AiBrowserIcon,
  },
  {
    id: "brandVoice",
    icon: PaintBoardIcon,
  },
  {
    id: "thread",
    icon: Comment01Icon,
  },
  {
    id: "faq",
    icon: HelpCircleIcon,
  },
];

/** What the Autopilot agent dock suggests: workflows its steps can build. */
export const AUTOPILOT_AGENT_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "competitorWatch",
    icon: Alert02Icon,
  },
  {
    id: "visibilityDigest",
    icon: ChartAnalysisIcon,
  },
  {
    id: "comebackPlan",
    icon: Target02Icon,
  },
];

/** On a workflow's page: questions about it first, then changes. */
export const AUTOPILOT_WORKFLOW_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "workflowExplain",
    icon: HelpCircleIcon,
  },
  {
    id: "workflowLastRun",
    icon: ChartAnalysisIcon,
  },
  {
    id: "workflowChange",
    icon: Comment01Icon,
  },
];

/** On a built-in automation's page: what it does and how it's been going. */
export const AUTOPILOT_AUTOMATION_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "automationExplain",
    icon: HelpCircleIcon,
  },
  {
    id: "automationAlongside",
    icon: Comment01Icon,
  },
];

export const CHAT_HOME_SUGGESTION_COUNT = 4;

/** Fallback order when a workspace has fewer than four personal suggestions. */
export const CHAT_HOME_STARTER_IDS = [
  "blogPost",
  "releaseNotes",
  "geoStatus",
  "socialPost",
  "newsletter",
  "comparison",
] as const;
