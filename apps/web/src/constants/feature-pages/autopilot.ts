import {
  AiBrain01Icon,
  AiChat02Icon,
  ArrowDataTransferHorizontalIcon,
  Clock01Icon,
  Loading03Icon,
  Search01Icon,
  SlackIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { StatusBadgeAppearance } from "@notra/ui/types/status-badge";

import type {
  AutopilotOutput,
  AutopilotPartner,
  AutopilotStageScenario,
  AutopilotStepState,
} from "@/types/autopilot-page";
import type {
  FeatureDetailCopy,
  FeatureDetailLink,
  FeatureStageImage,
} from "@/types/feature-detail-page";
import type { FaqContent } from "@/types/landing/faq";

export const AUTOPILOT_PAGE: FeatureDetailCopy = {
  meta: {
    path: "/features/autopilot",
    title: "Autopilot",
    description:
      "Name a goal and Notra Autopilot builds the workflow, runs it every day and opens draft pull requests on your website for you to approve.",
    ogImageKey: "features",
  },
  heroSubtitle:
    "Every morning Autopilot checks your AI answers, Google rankings and releases, then opens draft pull requests you can merge from Slack.",
  signupSource: "feature_autopilot",
  overview: {
    heading: "From a goal to a merged page",
    description:
      "Autopilot turns one sentence into a daily workflow, tells you in Slack what it found and opens pull requests you can merge.",
    facts: [],
  },
  steps: {
    heading: "How it works",
    items: [
      {
        title: "Describe the goal",
        description:
          "Write what Autopilot should watch, like a competitor in ChatGPT or pages that lost citations.",
      },
      {
        title: "Answer its questions",
        description:
          "If it needs more, like which competitor to compare against, it asks. Then it shows the workflow before saving it.",
      },
      {
        title: "Merge what it drafts",
        description:
          "The workflow runs daily, weekly or monthly. Changes arrive as draft pull requests that you merge or close.",
      },
    ],
  },
  cta: {
    heading: "See what Autopilot finds on your site",
    subcopy:
      "Connect your repository. The first run starts right away, then every morning at 9:00.",
  },
};

export const AUTOPILOT_HEADLINE = ["Your site gets better", "while you sleep."];

export const AUTOPILOT_HERO_SECONDARY_CTA: FeatureDetailLink = {
  label: "See how it works",
  href: "#how-autopilot-works",
};

export const AUTOPILOT_STAGE_IMAGE: FeatureStageImage = {
  src: "/features/autopilot/stage-clouds.webp",
  author: "Liane Metzler",
  authorUrl: "https://unsplash.com/@liane",
  photoUrl: "https://unsplash.com/photos/Y1ByvAGQ5iE",
  source: "Unsplash",
};

// The dock input's own strings, so the picture matches the dashboard.
export const AUTOPILOT_STAGE_INPUT = {
  placeholder: "Ask the agent, or tell Autopilot what to keep an eye on…",
  attach: "Attach files",
  send: "Send message",
} as const;

// Goals the hero types in turn, each with the workflow Autopilot builds for
// it. Every step is one the workflow builder really has.
export const AUTOPILOT_STAGE_SCENARIOS = [
  {
    goal: "Tell me when a competitor overtakes us in ChatGPT",
    steps: [
      {
        title: "Compare AI visibility",
        detail: "Acme against Peec and Profound on 48 prompts",
        result: "Peec now leads on 3 of 48 prompts",
        icon: ArrowDataTransferHorizontalIcon,
      },
      {
        title: "Let the agent decide",
        detail: "Did a competitor overtake you this week?",
        result: "Yes, Peec passed you this week",
        icon: AiBrain01Icon,
      },
      {
        title: "Post to Slack",
        detail: "#notra-autopilot, with what changed and why",
        result: "Posted at 9:02",
        icon: SlackIcon,
        brand: "slack",
      },
    ],
  },
  {
    goal: "Check every morning if Perplexity still recommends us",
    steps: [
      {
        title: "Scan a prompt",
        detail: "“Best CRM for startups” on Perplexity",
        result: "Acme is named 2nd of 5 tools",
        icon: Search01Icon,
      },
      {
        title: "Let the agent decide",
        detail: "Did Acme drop out of the answer?",
        result: "No, still in the top 3",
        icon: AiBrain01Icon,
      },
      {
        title: "Post to Slack",
        detail: "#marketing, with today’s answer",
        result: "Posted at 9:00",
        icon: SlackIcon,
        brand: "slack",
      },
    ],
  },
  {
    goal: "Warn me when AI answers stop citing our pricing page",
    steps: [
      {
        title: "Ask the agent",
        detail: "Which AI answers cite acme.com/pricing?",
        result: "Cited in 6 answers, down from 9",
        icon: AiChat02Icon,
      },
      {
        title: "Let the agent decide",
        detail: "Did citations drop since last week?",
        result: "Yes, 3 fewer than last week",
        icon: AiBrain01Icon,
      },
      {
        title: "Post to Slack",
        detail: "#growth, with the answers that dropped it",
        result: "Posted at 9:02",
        icon: SlackIcon,
        brand: "slack",
      },
    ],
  },
] as const satisfies readonly AutopilotStageScenario[];

// The same badges the dashboard uses for queued, running and finished work.
export const AUTOPILOT_STEP_STATUS = {
  queued: { label: "Queued", appearance: { variant: "secondary" } },
  running: {
    label: "Running",
    appearance: { variant: "warning", icon: Loading03Icon, spin: true },
  },
  done: {
    label: "Done",
    appearance: { variant: "success", icon: Tick02Icon, square: true },
  },
} as const satisfies Record<
  AutopilotStepState,
  { label: string; appearance: StatusBadgeAppearance }
>;

export const AUTOPILOT_STAGE_OUTPUTS: {
  label: string;
  items: AutopilotOutput[];
} = {
  label: "Runs every day at 9:00 and reports in",
  items: [
    { label: "#notra-autopilot", logo: "slack" },
    { label: "acme/website", logo: "github" },
    { label: "Email", logo: "email" },
  ],
};

export const AUTOPILOT_PARTNERS: { label: string; items: AutopilotPartner[] } =
  {
    label: "Reads and works with",
    items: [
      { label: "ChatGPT", logo: "chatgpt" },
      { label: "Claude", logo: "claude" },
      { label: "Gemini", logo: "gemini" },
      { label: "Perplexity", logo: "perplexity" },
      { label: "Google", logo: "google" },
      { label: "GitHub", logo: "github" },
      { label: "Slack", logo: "slack" },
    ],
  };

export const AUTOPILOT_FEATURES_ID = "how-autopilot-works";

export const AUTOPILOT_WORKFLOW_CARD = {
  copy: {
    title: "Describe it, and it builds the workflow",
    description:
      "Write a goal in plain words. If something is missing, Autopilot asks, then shows the steps before saving them.",
  },
  frame: { heading: "New workflow", subhead: "Runs every day at 9:00" },
  steps: [
    { name: "Every day at 9:00", kind: "Trigger", icon: Clock01Icon },
    {
      name: "Compare AI visibility with competitors",
      kind: "Step",
      icon: ArrowDataTransferHorizontalIcon,
    },
    { name: "Let the agent decide", kind: "Yes / No", icon: AiBrain01Icon },
    {
      name: "Post to Slack",
      kind: "Action",
      icon: SlackIcon,
      brand: "slack",
    },
  ],
} as const;

// Mirrors the brief Autopilot posts: one message with what is waiting, and a
// thread with one reply per item to react on.
export const AUTOPILOT_BRIEF_CARD = {
  copy: {
    title: "One message in Slack each morning",
    description:
      "React 👍 to merge a pull request or write an idea, 👎 to close it.",
  },
  frame: { heading: "Daily brief", subhead: "#notra-autopilot" },
  sender: "Notra",
  badge: "APP",
  time: "9:02 AM",
  headline: "Two drafts are ready for acme.com",
  waitingLabel: "Waiting on you (2 drafts)",
  waiting: [
    { title: "Acme vs Peec AI", meta: "Ready to merge · Comparison page" },
    { title: "Refresh “What is GEO?”", meta: "Ready to merge · Page refresh" },
  ],
  thread: { replies: "2 replies", last: "Last reply 9:03 AM" },
  reply: {
    time: "9:03 AM",
    title: "Acme vs Peec AI",
    meta: "PR #128 · Ready to merge",
    reactions: [
      // Autopilot pre-fills both, so one tap is all it takes.
      { emoji: "👍", count: 2, mine: true },
      { emoji: "👎", count: 1, mine: false },
    ],
  },
} as const;

export const AUTOPILOT_DRAFTS_CARD = {
  copy: {
    title: "Every change is a draft pull request",
    description:
      "Autopilot writes into your repository in your format. Nothing ships until someone merges it.",
  },
  frame: { heading: "Pull requests", subhead: "acme/website" },
  headers: { pullRequest: "Pull request", status: "Status" },
  rows: [
    {
      title: "Acme vs Peec AI",
      number: "#128",
      branch: "notra/autopilot-vs-peec",
      status: "draft",
    },
    {
      title: "Refresh “What is GEO?”",
      number: "#129",
      branch: "notra/autopilot-what-is-geo",
      status: "draft",
    },
    {
      title: "Add llms.txt and AI crawler rules",
      number: "#116",
      branch: "notra/autopilot-readiness",
      status: "merged",
    },
  ],
  statuses: { draft: "Draft", merged: "Merged" },
} as const;

export const AUTOPILOT_RESULTS_CARD = {
  copy: {
    title: "It checks its own work",
    description:
      "After a merge, Autopilot checks that Google indexed the page and tracks the number the change was meant to move.",
  },
  frame: { heading: "Merged by Autopilot", subhead: "Last 30 days" },
  headers: { change: "Change", metric: "Measures", result: "Before → now" },
  rows: [
    {
      change: "Acme vs Peec AI",
      metric: "Mention rate",
      before: "11%",
      now: "40%",
    },
    {
      change: "Refresh “What is GEO?”",
      metric: "Google position",
      before: "#7",
      now: "#3",
    },
    {
      change: "llms.txt and AI crawler rules",
      metric: "Readiness score",
      before: "62",
      now: "94",
    },
  ],
} as const;

export const AUTOPILOT_FAQ: FaqContent = {
  heading: "Frequently asked questions",
  subcopy: "What to know before you turn it on.",
  items: [
    {
      id: "autopilot-publish",
      question: "What can it publish on its own?",
      answer:
        "Nothing, unless you allow it. Every change is a draft pull request. You can set new posts, page updates and readiness fixes to Auto, and Autopilot then merges them the next weekday at 9:00 unless someone steps in.",
      defaultOpen: true,
    },
    {
      id: "autopilot-repos",
      question: "Which repositories and CMSs does it work with?",
      answer:
        "GitHub repositories, including blogs hosted on Notra Sites. It writes into your blog folder in your existing format. Other CMSs aren’t supported yet.",
      defaultOpen: false,
    },
    {
      id: "autopilot-schedule",
      question: "How often does it run?",
      answer:
        "Once a day at the time you pick, 9:00 by default. Workflows you describe can run daily, weekly or monthly, and release posts start when a pull request ships.",
      defaultOpen: false,
    },
    {
      id: "autopilot-cost",
      question: "What does it cost?",
      answer:
        "Autopilot is included in the Growth, Scale and Enterprise plans. It uses your workspace’s AI credits, and only when it writes something. Runs that find nothing to do are free.",
      defaultOpen: false,
    },
    {
      id: "autopilot-stop",
      question: "Can I stop it?",
      answer:
        "Yes. Turning off Autopilot stops every automation and the daily brief and keeps your settings. You can also pause a single workflow.",
      defaultOpen: false,
    },
  ],
};
