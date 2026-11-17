import {
  BalanceScaleIcon,
  Calendar03Icon,
  ChartDecreaseIcon,
  Clock01Icon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  Home01Icon,
  Link04Icon,
  NoteIcon,
  RefreshIcon,
  Robot01Icon,
  Search01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import type {
  AutopilotTemplate,
  AutopilotTemplateCategory,
} from "@/types/autopilot-templates";

export const AUTOPILOT_TEMPLATE_CATEGORIES: Record<
  AutopilotTemplateCategory,
  string
> = {
  site: "Site fixes",
  content: "Self-updating content",
  releases: "Releases and docs",
};

export const AUTOPILOT_TEMPLATE_TONES: Record<
  string,
  "destructive" | "info" | "success" | "warning"
> = {
  readiness: "info",
  keywords: "warning",
  commits: "success",
  refresh: "warning",
  comparisons: "info",
  rendering: "destructive",
  links: "success",
  landing: "info",
};

/** Literal classes per tone, so Tailwind sees every one of them. */
export const AUTOPILOT_TEMPLATE_TONE_TEXT = {
  destructive: "text-destructive",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
} as const;

export const AUTOPILOT_TEMPLATE_TRIGGER_LABELS: Record<
  AutopilotTemplate["trigger"],
  string
> = {
  run: "Every Autopilot run",
  merge: "When pull requests merge",
  weekly: "Once a week",
  drop: "When AI citations drop",
};

/** When a template runs and what it makes, short enough for a card's footer. */
export const AUTOPILOT_TEMPLATE_TRIGGER_CHIPS: Record<
  AutopilotTemplate["trigger"],
  { label: string; icon: IconSvgElement }
> = {
  run: { label: "Every run", icon: Clock01Icon },
  merge: { label: "PR merged", icon: GitMergeIcon },
  weekly: { label: "Weekly", icon: Calendar03Icon },
  drop: { label: "Citations drop", icon: ChartDecreaseIcon },
};

export const AUTOPILOT_TEMPLATE_OUTPUT_CHIPS: Record<
  AutopilotTemplate["output"],
  { label: string; icon: IconSvgElement }
> = {
  pull_request: { label: "Pull request", icon: GitPullRequestIcon },
  post: { label: "Post", icon: NoteIcon },
};

export const AUTOPILOT_TEMPLATE_OUTPUT_LABELS: Record<
  AutopilotTemplate["output"],
  string
> = {
  pull_request: "Opens a pull request",
  post: "Writes a post",
};

export const AUTOPILOT_TEMPLATES: AutopilotTemplate[] = [
  {
    id: "readiness",
    kind: "readiness",
    name: "Fix agent readiness",
    description: "Fixes llms.txt, AI crawler rules and structured data.",
    highlights: [
      "Rescans your site on every Autopilot run",
      "Adds llms.txt, AI crawler rules and structured data",
      "Opens a pull request for you to review and merge",
    ],
    instructions:
      "Run the Agent Readiness scan. For every failing check that can be fixed in the repository, open one pull request with the fix.",
    category: "site",
    icon: Robot01Icon,
    source: "Agent Readiness scan",
    output: "pull_request",
    trigger: "run",
  },
  {
    id: "rendering",
    kind: "rendering",
    name: "Make pages readable for AI",
    description: "Fixes content AI crawlers can't see without JavaScript.",
    highlights: [
      "Fetches your key pages without JavaScript, like an AI crawler",
      "Compares them with what a browser shows",
      "Renders missing content on the server and never adds copy",
    ],
    instructions:
      "Fetch the homepage, the pages AI cites and the sitemap's main pages without JavaScript and compare them with the rendered page. When most of the content is missing, render it on the server; never add copy.",
    category: "site",
    icon: ViewIcon,
    source: "Pages as AI crawlers see them",
    output: "pull_request",
    trigger: "run",
  },
  {
    id: "keywords",
    kind: "keywords",
    name: "Write for content gaps",
    description: "Drafts posts for prompts and searches you lose.",
    highlights: [
      "Picks the biggest prompt or search you lose to competitors",
      "Drafts a post that answers it",
      "Waits for your review before anything goes live",
    ],
    instructions:
      "Pick the prompt or search with the highest volume where competitors are mentioned and you aren't. Draft a post that answers it.",
    category: "content",
    icon: Search01Icon,
    source: "Prompts and searches you lose",
    output: "post",
    trigger: "run",
  },
  {
    id: "refresh",
    kind: "refresh",
    name: "Refresh pages AI stopped citing",
    description: "Updates pages AI cites less than last month.",
    highlights: [
      "Compares this month's AI citations with last month's",
      "Checks the page that dropped most against what engines cite now",
      "Opens a pull request with targeted edits, not a rewrite",
    ],
    instructions:
      "Compare how often AI answers cited each of your pages this month and last. For the page that dropped most, audit each section against the searches and the pages cited instead, then open a pull request with targeted edits.",
    category: "content",
    icon: RefreshIcon,
    source: "Your pages in AI citations",
    output: "pull_request",
    trigger: "drop",
  },
  {
    id: "comparisons",
    kind: "comparisons",
    name: "Write comparison pages",
    description: "Drafts comparison pages where AI picks a competitor.",
    highlights: [
      "Finds comparison questions where AI names a competitor and not you",
      "Drafts a fair page about the competitor that costs you most",
      "Sources claims from AI answers and the competitor's own site",
    ],
    instructions:
      "Find comparison and alternatives questions where AI answers name a competitor and leave you out. Draft a comparison page for the competitor that loses you the most, sourced from the answers and its own site.",
    category: "content",
    icon: BalanceScaleIcon,
    source: "Comparison prompts you lose",
    output: "post",
    trigger: "run",
  },
  {
    id: "links",
    kind: "links",
    name: "Add internal links",
    description: "Links your posts to pages ranking 4 to 20 in Google.",
    highlights: [
      "Reads three months of your Search Console data",
      "Links words your posts already use to pages ranking 4 to 20",
      "Adds at most three links per post, once a week",
    ],
    instructions:
      "Read three months of Search Console data. For pages ranking 4 to 20, find their top queries in your other posts and open one pull request that links those words to the page, at most three new links per post.",
    category: "content",
    icon: Link04Icon,
    source: "Your Search Console rankings",
    output: "pull_request",
    trigger: "weekly",
  },
  {
    id: "landing",
    kind: "landing",
    name: "Update landing page copy",
    description:
      "Rewrites landing pages AI cites less or Google ranks 4 to 20.",
    highlights: [
      "Picks a landing page that lost AI citations or ranks 4 to 20 in Google",
      "Rewrites its headings, text and metadata for those prompts and searches",
      "Changes only text: code, links and layout stay byte for byte",
    ],
    instructions:
      "Find a landing page rendered from code that AI answers cite less than a month ago, or that ranks 4 to 20 in Google. Rewrite its visible copy and metadata for the prompts and searches it is losing, using only facts from your own pages, and open a pull request that changes text only.",
    category: "content",
    icon: Home01Icon,
    source: "Your AI citations and Search Console rankings",
    output: "pull_request",
    trigger: "drop",
  },
  {
    id: "commits",
    kind: "commits",
    name: "Write about releases",
    description: "Drafts a post when you ship something worth sharing.",
    highlights: [
      "Reads the pull requests merged since the last run",
      "Picks the changes new users need explained",
      "Drafts a post about them for you to review",
    ],
    instructions:
      "Read the pull requests merged since the last run. When one is something new users need explained, draft a post about it.",
    category: "releases",
    icon: GitBranchIcon,
    source: "Pull requests you ship",
    output: "post",
    trigger: "merge",
  },
];
