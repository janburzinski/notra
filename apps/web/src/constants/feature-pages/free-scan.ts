import type {
  FeatureDetailCopy,
  FeatureFreeScanRow,
  FeatureFreeScanStat,
} from "@/types/feature-detail-page";
import type { FaqContent } from "@/types/landing/faq";

export const FREE_SCAN_PAGE: FeatureDetailCopy = {
  meta: {
    path: "/features/free-scan",
    title: "Free AI Visibility Scan for ChatGPT and AI Overviews",
    description:
      "Run a free generative engine optimization (GEO) and answer engine optimization (AEO) scan. See how ChatGPT and Google AI Overviews answer your buyers' questions and who they recommend.",
    ogImageKey: "features",
  },
  heroSubtitle: "See if ChatGPT and Google AI Overviews recommend you.",
  signupSource: "feature_free_scan",
  overview: {
    heading: "Real answers, not a guessed score",
    description:
      "Read every answer and see exactly where a competitor beats you.",
    facts: [
      {
        title: "30 answers",
        description: "15 buyer questions, asked on ChatGPT and AI Overviews.",
      },
      {
        title: "Rank, competitors and sources",
        description: "Who got named, in what order and which pages were cited.",
      },
      {
        title: "Free, no card",
        description: "One scan per company. Needs a work email.",
      },
    ],
  },
  steps: {
    heading: "Results in a few minutes",
    items: [
      {
        title: "Enter your website",
        description: "Then sign up with your work email.",
      },
      {
        title: "Confirm competitors",
        description: "Notra suggests them and drafts the questions.",
      },
      {
        title: "Read the answers",
        description: "Results land on your dashboard in minutes.",
      },
    ],
  },
  cta: {
    heading: "Find out if AI recommends you",
    subcopy: "Free scan, no card needed.",
  },
};

export const FREE_SCAN_HERO_CTA = "Scan free";

export const FREE_SCAN_FAQ: FaqContent = {
  heading: "Frequently asked questions",
  subcopy: "Before you run your scan.",
  items: [
    {
      id: "free-scan-cost",
      question: "Is it really free?",
      answer: "Yes. One scan per company, and you never add a card.",
      defaultOpen: true,
    },
    {
      id: "free-scan-work-email",
      question: "Why a work email?",
      answer:
        "The free scan is one per company, and your email domain tells us which company you are.",
      defaultOpen: false,
    },
    {
      id: "free-scan-geo-aeo",
      question: "What's the difference between GEO and AEO?",
      answer:
        "GEO is getting named in answers from assistants like ChatGPT. AEO is being the answer in search features like AI Overviews. The scan covers both.",
      defaultOpen: false,
    },
    {
      id: "free-scan-after",
      question: "What happens after the scan?",
      answer:
        "Your results stay on your dashboard. Pick a plan to rescan, add engines or track changes over time.",
      defaultOpen: false,
    },
  ],
};

export const FREE_SCAN_STATS: FeatureFreeScanStat[] = [
  { label: "Visibility", value: "40%" },
  { label: "Mentions", value: "13/30" },
  { label: "Avg. rank", value: "#2.3" },
];

export const FREE_SCAN_BRAND = "Lumen Analytics";

export const FREE_SCAN_ROWS: FeatureFreeScanRow[] = [
  {
    prompt: "Best analytics tool for a seed-stage startup",
    rank: 1,
    leader: "Lumen Analytics",
  },
  {
    prompt: "Privacy-friendly analytics without cookies",
    rank: 2,
    leader: "Northwind",
  },
  {
    prompt: "Analytics tools with a free plan and an API",
    rank: 4,
    leader: "Brightline",
  },
  {
    prompt: "How do I track feature adoption without a data team?",
    rank: 1,
    leader: "Lumen Analytics",
  },
  {
    prompt: "Self-hosted product analytics for regulated industries",
    rank: null,
    leader: "Northwind",
  },
];
