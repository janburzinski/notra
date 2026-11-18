import type {
  BillingPeriod,
  PricingFreePlan,
  PricingPlan,
  TrackedEngine,
} from "@/types/landing/pricing";

const ENGINE_LOGO_BASE = "/logos/ai-engines";

export const TRACKED_ENGINES: TrackedEngine[] = [
  {
    name: "ChatGPT",
    src: `${ENGINE_LOGO_BASE}/openai.svg`,
    darkSrc: `${ENGINE_LOGO_BASE}/openai-dark.svg`,
    width: 28,
  },
  { name: "Claude", src: `${ENGINE_LOGO_BASE}/claude.svg`, width: 28 },
  { name: "Gemini", src: `${ENGINE_LOGO_BASE}/gemini.svg`, width: 28 },
  { name: "Google", src: `${ENGINE_LOGO_BASE}/google.svg`, width: 28 },
];

export const PRICING_DEFAULT_BILLING: BillingPeriod = "monthly";

export const PRICING_BILLING_OPTIONS: BillingPeriod[] = ["monthly", "yearly"];

const SIGNUP_URL = "https://app.usenotra.com/signup";
const ENTERPRISE_MAIL_URL = "mailto:hello@usenotra.com";

export const PRICING_FREE_PLAN: PricingFreePlan = {
  name: "Free",
  price: "$0",
  cta: {
    labelId: "startFree",
    kind: "signup",
    href: SIGNUP_URL,
    source: "pricing_free",
    showArrow: true,
  },
  features: [
    { id: "events", count: 1, icon: "traffic" },
    { id: "agentFeedback", icon: "feedback" },
  ],
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "starter",
    answersPerMonth: 6_000,
    name: "Starter",
    price: { monthly: "$100", yearly: "$1,000" },
    hasAnnualBadge: true,
    variant: "default",
    cta: {
      labelId: "getStarted",
      kind: "signup",
      href: SIGNUP_URL,
      source: "pricing_starter",
      showArrow: true,
    },
    features: [
      { id: "answers", count: 6000, icon: "tracking" },
      {
        id: "events",
        count: 5,
        subtitle: "eventsShared",
        icon: "traffic",
      },
      { id: "images", count: 8, icon: "images" },
      { id: "posts", count: 10, icon: "content" },
      { id: "social", icon: "social" },
      { id: "projects", count: 1, icon: "projects" },
      {
        id: "references",
        count: 100,
        subtitle: "referencesOverage",
        price: "$0.05",
        icon: "references",
      },
      { id: "supportStandard", icon: "support" },
    ],
  },
  {
    id: "growth",
    answersPerMonth: 16_000,
    name: "Growth",
    price: { monthly: "$250", yearly: "$2,500" },
    hasAnnualBadge: true,
    variant: "featured",
    cta: {
      labelId: "getStarted",
      kind: "signup",
      href: SIGNUP_URL,
      source: "pricing_growth",
      showArrow: true,
    },
    features: [
      { id: "answers", count: 16000, icon: "tracking" },
      {
        id: "events",
        count: 15,
        subtitle: "eventsShared",
        icon: "traffic",
      },
      { id: "images", count: 20, icon: "images" },
      { id: "posts", count: 25, icon: "content" },
      { id: "social", icon: "social" },
      { id: "projects", count: 3, icon: "projects" },
      {
        id: "references",
        count: 500,
        subtitle: "referencesOverage",
        price: "$0.04",
        icon: "references",
      },
      { id: "supportStandard", icon: "support" },
    ],
  },
  {
    id: "scale",
    answersPerMonth: 35_000,
    name: "Scale",
    price: { monthly: "$550", yearly: "$5,500" },
    hasAnnualBadge: true,
    variant: "default",
    cta: {
      labelId: "getStarted",
      kind: "signup",
      href: SIGNUP_URL,
      source: "pricing_scale",
      showArrow: true,
    },
    features: [
      { id: "answers", count: 35000, icon: "tracking" },
      {
        id: "events",
        count: 30,
        subtitle: "eventsShared",
        icon: "traffic",
      },
      { id: "images", count: 45, icon: "images" },
      { id: "posts", count: 50, icon: "content" },
      { id: "social", icon: "social" },
      { id: "projects", count: 10, icon: "projects" },
      {
        id: "references",
        count: 1000,
        subtitle: "referencesOverage",
        price: "$0.03",
        icon: "references",
      },
      { id: "supportPriority", icon: "support" },
    ],
  },
  {
    id: "enterprise",
    answersPerMonth: null,
    name: "Enterprise",
    price: null,
    variant: "default",
    cta: {
      labelId: "contactUs",
      kind: "mail",
      href: ENTERPRISE_MAIL_URL,
      source: "pricing_enterprise",
      showArrow: false,
    },
    features: [
      { id: "answersUnlimited", icon: "tracking" },
      { id: "eventsUnlimited", icon: "traffic" },
      { id: "imagesUnlimited", icon: "images" },
      { id: "postsUnlimited", icon: "content" },
      { id: "social", icon: "social" },
      { id: "projectsUnlimited", icon: "projects" },
      { id: "referencesUnlimited", icon: "references" },
      { id: "supportDedicated", icon: "support" },
    ],
  },
];

export const PRICING_CAROUSEL_PLANS: PricingPlan[] = [
  ...PRICING_PLANS.filter((plan) => plan.variant === "featured"),
  ...PRICING_PLANS.filter((plan) => plan.variant !== "featured"),
];
