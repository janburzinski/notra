import {
  AiMagicIcon,
  Alert02Icon,
  AlertCircleIcon,
  Archive02Icon,
  BalanceScaleIcon,
  BulbIcon,
  Calendar03Icon,
  Cancel01Icon,
  ChartAnalysisIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  FilterIcon,
  GitBranchIcon,
  Github01Icon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
  Idea01Icon,
  Image02Icon,
  Link04Icon,
  Loading03Icon,
  MinusSignCircleIcon,
  PauseIcon,
  PencilEdit02Icon,
  PlayIcon,
  RefreshIcon,
  Robot01Icon,
  Rocket01Icon,
  Search01Icon,
  SlackIcon,
  Tick02Icon,
  UserGroupIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type {
  AutopilotEventLevel,
  AutopilotFindingStatus,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";
import { DURATION, EASE } from "@notra/ui/lib/motion";
import type { StatusBadgeAppearance } from "@notra/ui/types/status-badge";

import { AUTOPILOT_WORKFLOW_BLOCK_TYPES } from "@/constants/autopilot-workflows";
import { CONTENT_PULL_REQUEST_STATES } from "@/constants/content-overview";
import type {
  AutopilotRunSectionState,
  AutopilotTranscriptStepKind,
} from "@/types/autopilot";
import type {
  AutopilotAutomationKind,
  AutopilotMetricsDays,
  AutopilotOutcomeKey,
  AutopilotRunTrigger,
} from "@/types/autopilot-metrics";
import type { AutopilotWorkflowDraftStatus } from "@/types/autopilot-workflows";
import type { GitHubMergeMethod } from "@/types/integrations/github";

/** Tabs of the Autopilot page, in order; the first is the default. */
export const AUTOPILOT_PAGE_TABS = [
  "automations",
  "pull-requests",
  "analytics",
  "settings",
] as const;

/** What Autopilot does, as the boxes of the first setup step. */
export const AUTOPILOT_SETUP_HIGHLIGHTS = [
  {
    icon: Clock01Icon,
    title: "Every morning",
    description: "Runs once a day, at your time.",
  },
  {
    icon: GitPullRequestIcon,
    title: "Draft pull requests",
    description: "Fixes and new posts.",
  },
  {
    icon: SlackIcon,
    title: "Daily brief",
    description: "A short summary in Slack.",
  },
  {
    icon: Tick02Icon,
    title: "You decide",
    description: "Nothing ships without a merge.",
  },
] as const satisfies readonly {
  icon: IconSvgElement;
  title: string;
  description: string;
}[];

/** Steps of the first setup on the Autopilot page, in order. */
export const AUTOPILOT_SETUP_STEP_IDS = [
  "intro",
  "automations",
  "connect",
] as const;

export const AUTOPILOT_SETUP_STEPS = {
  intro: {
    label: "Overview",
    title: "Let Notra work for you every day",
    description: "Autopilot checks your site every morning and does the work.",
  },
  automations: {
    label: "Automations",
    title: "Automations",
    description: "Pick what Autopilot does for you.",
  },
  connect: {
    label: "Connect",
    title: "Connect",
    description: "Your repo for pull requests, Slack for the brief.",
  },
} as const satisfies Record<
  (typeof AUTOPILOT_SETUP_STEP_IDS)[number],
  { label: string; title: string; description: string }
>;

/** What a Slack brief button asks the Autopilot page to do with ?finding=…&action=… */
export const AUTOPILOT_LINK_ACTIONS = ["merge", "dismiss"] as const;

export const AUTOPILOT_METRIC_RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
] as const satisfies readonly { days: AutopilotMetricsDays; label: string }[];

/** Where the ideas of a period ended up, in the Analytics tab's order. */
export const AUTOPILOT_OUTCOMES = [
  {
    key: "merged",
    label: "Merged",
    icon: GitMergeIcon,
    iconClassName: "text-primary",
    className: "bg-primary",
  },
  {
    key: "inReview",
    label: "In review",
    icon: GitPullRequestIcon,
    iconClassName: "text-success",
    className: "bg-success",
  },
  {
    key: "suggested",
    label: "Suggested",
    icon: BulbIcon,
    iconClassName: "text-info",
    className: "bg-info",
  },
  {
    key: "dismissed",
    label: "Closed",
    icon: GitPullRequestClosedIcon,
    iconClassName: "text-destructive",
    className: "bg-destructive/70",
  },
  {
    key: "expired",
    label: "Auto-closed",
    icon: Archive02Icon,
    iconClassName: "text-muted-foreground",
    className: "bg-muted-foreground/40",
  },
  {
    key: "failed",
    label: "Failed",
    icon: AlertCircleIcon,
    iconClassName: "text-warning",
    className: "bg-warning",
  },
] as const satisfies readonly {
  key: AutopilotOutcomeKey;
  label: string;
  icon: IconSvgElement;
  iconClassName: string;
  className: string;
}[];

/** The Analytics tab's stat strip, in order; shown as skeletons while loading. */
export const AUTOPILOT_ANALYTICS_STAT_LABELS = [
  "PRs opened",
  "PRs merged",
  "Merge rate",
  "Median time to merge",
] as const;

/** Legend of the Pull requests chart; matches CHART_PRIMARY/SECONDARY_COLOR. */
export const AUTOPILOT_ACTIVITY_LEGEND = [
  {
    key: "opened",
    label: "Opened",
    className: "bg-[#8B5CF6] dark:bg-[#9C87E3]",
  },
  {
    key: "merged",
    label: "Merged",
    className: "bg-[#18929F] dark:bg-[#20ABBA]",
  },
] as const;

/** Segment colors of the Runs breakdown, busiest trigger first in practice. */
export const AUTOPILOT_TRIGGER_COLORS: Record<AutopilotRunTrigger, string> = {
  cron: "bg-primary",
  github: "bg-[#18929F] dark:bg-[#20ABBA]",
  suggestion: "bg-primary/45",
  manual: "bg-muted-foreground/40",
  onboarding: "bg-muted-foreground/25",
};

/** What started a run, at the front of its row in the runs table. */
export const AUTOPILOT_TRIGGER_ICONS: Record<
  AutopilotRunTrigger,
  IconSvgElement
> = {
  cron: Calendar03Icon,
  github: Github01Icon,
  suggestion: Idea01Icon,
  manual: PlayIcon,
  onboarding: Rocket01Icon,
};

/** Kinds whose pull requests come from the planner's confidence; templates act on evidence instead. */
export const AUTOPILOT_PLANNED_KINDS: readonly AutopilotJobKind[] = [
  "keywords",
  "commits",
];

/** Short labels for anything Autopilot did, e.g. the automation of a pull request. */
export const AUTOPILOT_KIND_META: Record<
  AutopilotJobKind,
  { label: string; icon: typeof Robot01Icon }
> = {
  readiness: { label: "Agent readiness", icon: Robot01Icon },
  keywords: { label: "Content gaps", icon: Search01Icon },
  commits: { label: "Releases", icon: GitBranchIcon },
  prompts: { label: "Prompts", icon: AiMagicIcon },
  competitors: { label: "Competitors", icon: UserGroupIcon },
  refresh: { label: "Page refresh", icon: RefreshIcon },
  comparisons: { label: "Comparisons", icon: BalanceScaleIcon },
  rendering: { label: "AI-readable pages", icon: ViewIcon },
  links: { label: "Internal links", icon: Link04Icon },
};

/** How one automation in a run ended, as the run panel's section badge. */
export const AUTOPILOT_RUN_SECTION_BADGES: Record<
  AutopilotRunSectionState,
  { label: string; appearance: StatusBadgeAppearance }
> = {
  running: { label: "Running", appearance: { variant: "secondary" } },
  done: { label: "Done", appearance: { variant: "success" } },
  skipped: { label: "Skipped", appearance: { variant: "secondary" } },
  failed: { label: "Failed", appearance: { variant: "destructive" } },
};

/** What a run section made, e.g. its pull request, inside the run panel. */
export const AUTOPILOT_RUN_RESULT_CLASS =
  "bg-muted/40 animate-in fade-in flex max-w-3xl items-center gap-3 rounded-lg border px-3 py-2.5 duration-300 motion-reduce:animate-none";

export const AUTOPILOT_TRANSCRIPT_STEP_ICONS: Record<
  AutopilotTranscriptStepKind,
  IconSvgElement
> = {
  gather: FilterIcon,
  lookup: Search01Icon,
  draft: PencilEdit02Icon,
  image: Image02Icon,
  skip: MinusSignCircleIcon,
  error: Cancel01Icon,
  other: Tick02Icon,
};

/**
 * The automations as the dashboard explains them: what each does, what it
 * reads, what it hands you, and what besides the daily run starts it.
 */
export const AUTOPILOT_AUTOMATIONS: Record<
  AutopilotAutomationKind,
  {
    name: string;
    description: string;
    source: string;
    output: string;
    /** What the waiting pull request is, in "the next … opens". */
    noun: string;
    alsoOn: string | null;
  }
> = {
  readiness: {
    name: "Fix agent readiness",
    description:
      "Rescans your site and opens a pull request for llms.txt, AI crawler rules and structured data.",
    source: "Your Agent Readiness scan",
    output: "Opens a pull request",
    noun: "fix",
    alsoOn: null,
  },
  keywords: {
    name: "Write for content gaps",
    description:
      "Drafts a post for prompts and searches where competitors show up and you don't.",
    source: "Prompts and searches you lose",
    output: "Writes a post",
    noun: "post",
    alsoOn: null,
  },
  commits: {
    name: "Write about releases",
    description:
      "Drafts a post when you ship something worth telling users about.",
    source: "Pull requests you ship",
    output: "Writes a post",
    noun: "post",
    alsoOn: "And when a pull request ships",
  },
  refresh: {
    name: "Refresh pages AI stopped citing",
    description:
      "Finds your pages that AI answers cite less than before and opens a pull request with targeted updates.",
    source: "Your pages in AI citations",
    output: "Opens a pull request",
    noun: "refresh",
    alsoOn: null,
  },
  comparisons: {
    name: "Write comparison pages",
    description:
      "Drafts a comparison page when AI answers to comparison questions show a competitor and not you.",
    source: "Comparison prompts you lose",
    output: "Writes a page",
    noun: "page",
    alsoOn: null,
  },
  rendering: {
    name: "Make pages readable for AI",
    description:
      "Checks what AI crawlers get from your key pages and opens a pull request when content only shows up with JavaScript.",
    source: "Your pages, fetched like an AI crawler",
    output: "Opens a pull request",
    noun: "fix",
    alsoOn: null,
  },
  links: {
    name: "Add internal links",
    description:
      "Links your posts to pages that rank on page one or two of Google for the words they already use, once a week.",
    source: "Your Search Console rankings",
    output: "Opens a pull request",
    noun: "links pull request",
    alsoOn: "At most one pull request a week",
  },
};

/** One automation's outcome in a run, by the level it was logged at. */
export const AUTOPILOT_JOB_DECISION_BADGES: Record<
  AutopilotEventLevel,
  { label: string; appearance: StatusBadgeAppearance }
> = {
  info: { label: "Noted", appearance: { variant: "secondary" } },
  skip: { label: "Skipped", appearance: { variant: "secondary" } },
  decision: { label: "Decided", appearance: { variant: "info" } },
  action: { label: "Opened", appearance: { variant: "success" } },
  error: { label: "Failed", appearance: { variant: "destructive" } },
};

/** URL segment of each automation's page under /autopilot. */
export const AUTOPILOT_AUTOMATION_SLUGS: Record<
  AutopilotAutomationKind,
  string
> = {
  readiness: "agent-readiness",
  keywords: "content-gaps",
  commits: "releases",
  refresh: "page-refresh",
  comparisons: "comparison-pages",
  rendering: "ai-readable-pages",
  links: "internal-links",
};

/** GitHub's merge buttons, in GitHub's words; squash is the default. */
export const AUTOPILOT_MERGE_METHOD_LABELS: Record<GitHubMergeMethod, string> =
  {
    squash: "Squash and merge",
    merge: "Create a merge commit",
    rebase: "Rebase and merge",
  };
export const AUTOPILOT_MERGE_METHODS = Object.keys(
  AUTOPILOT_MERGE_METHOD_LABELS
) as GitHubMergeMethod[];

/** The icon in front of a finding's title: its GitHub state, or what it is before it has one. */
export const AUTOPILOT_FINDING_ICONS: Record<
  AutopilotFindingStatus,
  { icon: IconSvgElement; className: string }
> = {
  suggested: { icon: Idea01Icon, className: "text-muted-foreground" },
  open: { icon: PencilEdit02Icon, className: "text-muted-foreground" },
  proposed: CONTENT_PULL_REQUEST_STATES.open,
  merged: CONTENT_PULL_REQUEST_STATES.merged,
  dismissed: CONTENT_PULL_REQUEST_STATES.closed,
  expired: {
    icon: CONTENT_PULL_REQUEST_STATES.closed.icon,
    className: "text-muted-foreground",
  },
  failed: { icon: AlertCircleIcon, className: "text-destructive" },
};

/**
 * The GitHub state icon for a finding with a pull request, in GitHub's
 * colours. An auto-closed draft is closed too, just in grey: nobody said no.
 */
export const AUTOPILOT_PULL_REQUEST_STATES: Partial<
  Record<
    AutopilotFindingStatus,
    {
      icon: IconSvgElement;
      variant: StatusBadgeAppearance["variant"];
      /** Merged has no soft badge colour of its own; GitHub shows it purple. */
      className?: string;
      label: string;
    }
  >
> = {
  proposed: {
    icon: CONTENT_PULL_REQUEST_STATES.open.icon,
    variant: "success",
    label: "Open",
  },
  merged: {
    icon: CONTENT_PULL_REQUEST_STATES.merged.icon,
    variant: "secondary",
    className:
      "bg-primary/10 text-primary dark:bg-primary/20 [a]:hover:bg-primary/20",
    label: "Merged",
  },
  dismissed: {
    icon: CONTENT_PULL_REQUEST_STATES.closed.icon,
    variant: "destructive",
    label: "Closed",
  },
  expired: {
    icon: CONTENT_PULL_REQUEST_STATES.closed.icon,
    variant: "secondary",
    label: "Closed automatically because nobody touched it",
  },
};

/** Room for an empty table's icon, title and text; a one-row table would clip them. */
export const AUTOPILOT_EMPTY_TABLE_HEIGHT = 300;

export const AUTOPILOT_WORKFLOW_STEP_ICONS = {
  "core.trigger": Clock01Icon,
  "core.if": GitBranchIcon,
  "core.switch": GitBranchIcon,
  [AUTOPILOT_WORKFLOW_BLOCK_TYPES.compareVisibility]: ChartAnalysisIcon,
  [AUTOPILOT_WORKFLOW_BLOCK_TYPES.askAgent]: AiMagicIcon,
  [AUTOPILOT_WORKFLOW_BLOCK_TYPES.decide]: GitBranchIcon,
  [AUTOPILOT_WORKFLOW_BLOCK_TYPES.postToSlack]: SlackIcon,
} as const satisfies Record<string, IconSvgElement>;

/** A white card on the agent dock's grey tray, like the agent panel's body. */
export const AUTOPILOT_AGENT_DOCK_CARD_CLASS =
  "bg-background border-border/70 overflow-hidden rounded-lg border";

/**
 * Full screen fills the page and lays the dock out on a grid, so the chat,
 * the input and the preview keep their place in the tree when the dock
 * changes size.
 */
export const AUTOPILOT_AGENT_DOCK_FULLSCREEN_CLASS =
  "bg-muted h-full min-h-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-x-1 px-1 pb-1 [grid-template-areas:'header'_'chat'_'input'] lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] lg:[grid-template-areas:'header_header'_'chat_aside'_'input_aside']";

/** The workflow preview zooms out this far to show every step at once. */
export const AUTOPILOT_WORKFLOW_PREVIEW_FIT_MIN_ZOOM = 0.4;

/** How each state of a proposed workflow shows, as its badge. */
export const AUTOPILOT_WORKFLOW_DRAFT_STATUS = {
  drafting: {
    key: "building",
    appearance: { variant: "info", icon: Loading03Icon, spin: true },
  },
  "awaiting-approval": {
    key: "awaitingApproval",
    appearance: { variant: "warning", icon: PauseIcon },
  },
  saving: {
    key: "saving",
    appearance: { variant: "info", icon: Loading03Icon, spin: true },
  },
  saved: {
    key: "saved",
    appearance: { variant: "success", icon: CheckmarkCircle02Icon },
  },
  "needs-fixes": {
    key: "needsFixes",
    appearance: { variant: "warning", icon: Alert02Icon },
  },
  discarded: {
    key: "discarded",
    appearance: { variant: "secondary", icon: Cancel01Icon },
  },
  failed: {
    key: "failed",
    appearance: { variant: "destructive", icon: Alert02Icon },
  },
} as const satisfies Record<
  AutopilotWorkflowDraftStatus,
  { key: string; appearance: object }
>;

/** How a workflow step's state shows next to it on the workflow page. */
export const AUTOPILOT_WORKFLOW_STEP_STATUS = {
  success: {
    icon: CheckmarkCircle02Icon,
    className: "text-geo-up",
    label: "Done",
  },
  running: {
    icon: Loading03Icon,
    className: "text-warning motion-safe:animate-spin",
    label: "Running",
  },
  retrying: {
    icon: Loading03Icon,
    className: "text-warning motion-safe:animate-spin",
    label: "Retrying",
  },
  error: { icon: Cancel01Icon, className: "text-destructive", label: "Failed" },
  halted: {
    icon: MinusSignCircleIcon,
    className: "text-muted-foreground",
    label: "Stopped",
  },
  skipped: {
    icon: MinusSignCircleIcon,
    className: "text-muted-foreground/70",
    label: "Skipped",
  },
} as const;

/** The dock's conversation grows out of the input, and folds back faster. */
export const AUTOPILOT_AGENT_DOCK_ENTER = {
  duration: 0.25,
  ease: EASE.emphasized,
};
export const AUTOPILOT_AGENT_DOCK_EXIT = {
  duration: DURATION.fast,
  ease: EASE.out,
};
