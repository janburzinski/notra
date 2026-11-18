import type {
  EngineRateRow,
  GapRow,
  KpiTile,
  ShareRow,
  TrafficSourceRow,
} from "@/types/landing/geo";

export const FEATURES_TABLE_OPTIONAL_COL = "hidden @lg:table-cell";

export const FEATURES_ENGINE_ROWS: EngineRateRow[] = [
  {
    id: "chatgpt",
    mentionRate: 71,
    mentions: 20,
    checks: 28,
    avgPosition: 2.1,
    lastCheckedHours: 2,
  },
  {
    id: "perplexity",
    mentionRate: 58,
    mentions: 16,
    checks: 28,
    avgPosition: 2.6,
    lastCheckedHours: 2,
  },
  {
    id: "claude",
    mentionRate: 52,
    mentions: 15,
    checks: 28,
    avgPosition: 2.4,
    lastCheckedHours: 2,
  },
  {
    id: "gemini",
    mentionRate: 41,
    mentions: 12,
    checks: 28,
    avgPosition: 3.2,
    lastCheckedHours: 2,
  },
  {
    id: "grok",
    mentionRate: 33,
    mentions: 9,
    checks: 28,
    avgPosition: 3.8,
    lastCheckedHours: 3,
  },
  {
    id: "kimi",
    mentionRate: 21,
    mentions: 6,
    checks: 28,
    avgPosition: 4.4,
    lastCheckedHours: 3,
  },
];

export const FEATURES_SHARE_ROWS: (ShareRow & { type: string })[] = [
  {
    id: "notra",
    brand: "Notra",
    logo: { src: "/notra-mark.svg", tileOnDark: true },
    share: 31,
    mentions: 96,
    color: "#8B5CF6",
    isYou: true,
    type: "You",
  },
  {
    id: "profound",
    brand: "Profound",
    logo: {
      src: "/logos/competitors/profound-light.svg",
      darkSrc: "/logos/competitors/profound-dark.svg",
    },
    share: 24,
    mentions: 74,
    color: "#F59E0B",
    type: "Direct",
  },
  {
    id: "prompting-company",
    brand: "The Prompting Company",
    logo: {
      src: "/logos/competitors/prompting-company.png",
      invertOnDark: true,
    },
    share: 17,
    mentions: 52,
    color: "#10B981",
    type: "Direct",
  },
  {
    id: "peec",
    brand: "Peec AI",
    logo: { src: "/logos/competitors/peec.png", invertOnDark: true },
    share: 12,
    mentions: 38,
    color: "#0EA5E9",
    type: "Direct",
  },
  {
    id: "promptwatch",
    brand: "Promptwatch",
    logo: { src: "/logos/competitors/promptwatch.svg" },
    share: 9,
    mentions: 28,
    color: "#F43F5E",
    type: "Direct",
  },
  {
    id: "bydefault",
    brand: "ByDefault",
    logo: { src: "/logos/competitors/bydefault.svg" },
    share: 7,
    mentions: 21,
    color: "#64748B",
    type: "Direct",
  },
];

export const FEATURES_TRAFFIC_KPIS: KpiTile[] = [
  { id: "crawlers", value: 1204 },
  { id: "referrals", value: 318 },
  { id: "total", value: 1522 },
];

export const FEATURES_TRAFFIC_ROWS: TrafficSourceRow[] = [
  {
    id: "t-1",
    source: "ChatGPT-User",
    engine: "chatgpt",
    purpose: "assistant-browse",
    visits: 412,
    lastSeenSeconds: 2,
  },
  {
    id: "t-2",
    source: "PerplexityBot",
    engine: "perplexity",
    purpose: "search-index",
    visits: 287,
    lastSeenSeconds: 9,
  },
  {
    id: "t-3",
    source: "ClaudeBot",
    engine: "claude",
    purpose: "training-crawler",
    visits: 198,
    lastSeenSeconds: 60,
  },
  {
    id: "t-4",
    source: "GPTBot",
    engine: "chatgpt",
    purpose: "training-crawler",
    visits: 176,
    lastSeenSeconds: 31,
  },
  {
    id: "t-5",
    source: "ChatGPT",
    engine: "chatgpt",
    purpose: "assistant-referral",
    visits: 154,
    lastSeenSeconds: 240,
  },
  {
    id: "t-6",
    source: "Claude-User",
    engine: "claude",
    purpose: "assistant-browse",
    visits: 91,
    lastSeenSeconds: 14,
  },
  {
    id: "t-7",
    source: "Perplexity",
    engine: "perplexity",
    purpose: "assistant-referral",
    visits: 63,
    lastSeenSeconds: 48,
  },
];

export const FEATURES_GAP_ROWS: GapRow[] = [
  {
    id: "geoMetrics",
    opportunity: 5,
    mentionRate: 0,
    missing: ["chatgpt", "claude", "gemini", "perplexity", "grok"],
  },
  {
    id: "b2bPlatforms",
    opportunity: 4,
    mentionRate: 38,
    missing: ["claude", "gemini", "perplexity"],
  },
  {
    id: "perplexityCitations",
    opportunity: 4,
    mentionRate: 0,
    missing: ["chatgpt", "claude", "gemini", "perplexity"],
  },
  {
    id: "aiCrawlers",
    opportunity: 3,
    mentionRate: 20,
    missing: ["chatgpt", "gemini", "grok"],
  },
  {
    id: "whatIsGeo",
    opportunity: 2,
    mentionRate: 40,
    missing: ["gemini", "grok"],
  },
];
