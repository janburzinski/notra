import { SITE_URL } from "@/utils/urls";

export const DATA_PATH = "/data";
export const DATA_URL = `${SITE_URL}${DATA_PATH}`;
const DATA_JSON_PATH = `${DATA_PATH}/index.json`;
export const DATA_JSON_URL = `${SITE_URL}${DATA_JSON_PATH}`;

export const DATA_TITLE = "State of AI Traffic";
export const DATA_DESCRIPTION =
  "Which AI crawlers and assistants visit websites, ranked by real traffic across the sites that use Notra. Anonymized and updated every day.";
export const DATA_SIGNUP_SOURCE = "data_page";
export const DATA_CTA_HEADING = "See the AI traffic on your own site";
export const DATA_CTA_SUBCOPY =
  "Notra shows which AI crawlers read your pages and which assistants send you visitors.";

/**
 * Days most AI traffic events were lost at ingest; the dashboard leaves them
 * out of the chart's averages. Noted while a charted week still reaches them:
 * the first chart day's week starts six days before the window does.
 */
export const DATA_INGEST_GAP = {
  notedUntil: "2026-11-10",
  note: "Oct 31 – Nov 4 are left out of the averages: most events from those days were lost at ingest.",
};

/** The dashboard publishes the snapshot; it holds the analytics credentials. */
export const DATA_SNAPSHOT_PATH = "/api/public/data/ai-traffic";
/** Refetch at most this often per server instance; snapshots change once a day. */
export const DATA_SNAPSHOT_MEMORY_TTL_MS = 15 * 60 * 1000;
export const DATA_SNAPSHOT_TIMEOUT_MS = 20_000;
/** After a failed refresh, the last good snapshot serves this long before the next try. */
export const DATA_SNAPSHOT_RETRY_MS = 60_000;

export const DATA_CACHE_CONTROL =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/** The dashboard's chart colors: violet for crawlers, amber for referrals. */
export const DATA_CRAWLER_COLOR = {
  light: "#8B5CF6",
  dark: "#9C87E3",
} as const;
export const DATA_REFERRAL_COLOR = {
  light: "#E89A1C",
  dark: "#FFB547",
} as const;
export const DATA_CRAWLER_BAR_CLASS = "bg-[#8B5CF6] dark:bg-[#9C87E3]";
export const DATA_REFERRAL_BAR_CLASS = "bg-[#E89A1C] dark:bg-[#FFB547]";

/** Rows the chart tooltip lists before "+N more", as on the dashboard. */
export const DATA_TOOLTIP_MAX_ROWS = 8;
/** Fewer rows on touch, where the tooltip has to fit inside the chart. */
export const DATA_TOUCH_TOOLTIP_MAX_ROWS = 4;

export const DATA_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The page's own hover cards (heatmap cells, share bars), matching the charts' glass tooltip. */
export const DATA_TOOLTIP_CLASS =
  "border-border/60 bg-background/90 pointer-events-none absolute bottom-full z-20 mb-2 grid w-max gap-1 rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-md";

/** Heatmap cells never fade out fully, so quiet hours still read as measured. */
export const DATA_HEAT_FLOOR = 0.06;

export const DATA_PURPOSE_LABELS: Record<string, string> = {
  "training-crawler": "Model training",
  "search-index": "Search index",
  "assistant-browse": "Cited in answer",
};

/** Company sites for logos; bots and assistants show their company's logo. */
export const DATA_VENDOR_DOMAINS: Record<string, string> = {
  OpenAI: "openai.com",
  Anthropic: "anthropic.com",
  Google: "google.com",
  Perplexity: "perplexity.ai",
  Meta: "meta.com",
  ByteDance: "bytedance.com",
  Amazon: "amazon.com",
  Apple: "apple.com",
  Microsoft: "microsoft.com",
  "Common Crawl": "commoncrawl.org",
  DuckDuckGo: "duckduckgo.com",
  Mistral: "mistral.ai",
  xAI: "x.ai",
  DeepSeek: "deepseek.com",
  "You.com": "you.com",
  Cohere: "cohere.com",
  "Moonshot AI": "moonshot.ai",
  Alibaba: "alibaba.com",
  Huawei: "huawei.com",
  Baidu: "baidu.com",
  Exa: "exa.ai",
  Firecrawl: "firecrawl.dev",
  Tavily: "tavily.com",
  Kagi: "kagi.com",
  Anysphere: "cursor.com",
  Cognition: "cognition.ai",
  Parallel: "parallel.ai",
  Diffbot: "diffbot.com",
  Cloudflare: "cloudflare.com",
  Mozilla: "mozilla.org",
  OpenCode: "opencode.ai",
  "Zhipu AI": "zhipuai.cn",
  Ai2: "allenai.org",
  "Webz.io": "webz.io",
  Liner: "liner.com",
};

/**
 * The page's boxes: a white top highlight inside every card and shell, and a
 * soft dark drop so they lift off the page. Dark mode swaps the highlight for
 * a faint white rim. Scoped to the page and its drawer.
 */
export const DATA_SURFACE_CLASS =
  "[--table-card-shadow:inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(15_15_20/0.08),0_6px_16px_-8px_rgb(15_15_20/0.14)] [&_.bg-table-shell]:shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(15_15_20/0.05)] dark:[--table-card-shadow:inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.5),0_8px_20px_-10px_rgb(0_0_0/0.7)] dark:[&_.bg-table-shell]:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_2px_8px_rgb(0_0_0/0.45)]";
