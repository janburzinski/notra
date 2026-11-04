import { UTILITY_MODEL_ID } from "@notra/ai/constants/models";

import type {
  GscBuyingIntentRule,
  GscBuyingIntentSection,
} from "../types/google-search-console";

export const GSC_OAUTH_STATE_TTL_SECONDS = 600;
export const GSC_OAUTH_STATE_KEY_PREFIX = "gsc_oauth:";
export const GSC_OAUTH_CALLBACK_PATH =
  "/api/integrations/google-search-console/callback";
export const GSC_OAUTH_AUTHORIZE_PATH =
  "/api/integrations/google-search-console/authorize";
export const GSC_SYNC_WORKFLOW_PATH = "/api/workflows/gsc-sync";
/** Mondays 06:00 UTC */
export const GSC_SYNC_CRON = "0 6 * * 1";
export const GSC_SYNC_LOOKBACK_DAYS = 28;
/**
 * Google returns rows sorted by clicks. A wider pull keeps high-impression
 * queries that almost nobody clicks, which are the content gaps.
 */
export const GSC_SYNC_ROW_LIMIT = 2000;
/** Queries below this are noise and waste model context. */
export const GSC_SYNC_MIN_IMPRESSIONS = 5;
export const GSC_SYNC_MAX_KEYWORDS_FOR_MODEL = 80;
/**
 * Leading question words in the languages our customers search in, plus a
 * trailing "?". Sent to Search Console as an RE2 `includingRegex` filter and
 * reused client-side, so it must stay inside the RE2/JS common subset: no
 * lookarounds, no flags (Search Console lowercases queries), and `\s` instead
 * of `\b`, which never matches after an accented letter such as "qué".
 */
export const GSC_QUESTION_QUERY_PATTERN =
  "^(?:who|whom|whose|what|when|where|which|why|how|is|are|can|could|should|would|will|do|does|did|wer|wie|was|wann|wo|woher|wohin|welche|welcher|welches|warum|wieso|weshalb|kann|muss|soll|ist|sind|gibt|qué|que|cómo|como|cuál|cuáles|cuándo|dónde|por qué|quién|comment|pourquoi|quel|quelle|quels|quelles|quand|où|est-ce)\\s|\\?$";
/**
 * Question queries are long tail: a few impressions each, so they rarely make
 * the click-sorted top rows. A separate pull finds them.
 */
export const GSC_QUESTION_ROW_LIMIT = 1000;
/** A question is the searcher's own wording, so a lower floor still is signal. */
export const GSC_QUESTION_MIN_IMPRESSIONS = 2;
/**
 * Model slots for questions: reserved so head terms cannot crowd them out, and
 * capped so questions cannot crowd out the head terms either.
 */
export const GSC_SYNC_MAX_QUESTIONS_FOR_MODEL = 30;
/**
 * Query and page pairs pulled to find the page Google ranks per query. Pairs
 * outnumber queries and come click-sorted, so this is Google's maximum, to
 * reach the low-click queries that become gaps.
 */
export const GSC_PAGE_ROW_LIMIT = 25_000;
/**
 * Words of a searcher comparing options, checking prices or reading reviews,
 * by the section a ranking page would need to answer them. Checked in order,
 * so "x alternatives vs y" counts as alternatives.
 */
export const GSC_BUYING_INTENT_RULES: readonly GscBuyingIntentRule[] = [
  {
    section: "alternatives",
    terms: [
      "alternative",
      "alternatives",
      "alternativen",
      "alternativa",
      "alternativas",
      "competitor",
      "competitors",
      "konkurrenten",
    ],
  },
  {
    section: "comparison",
    terms: [
      "vs",
      "versus",
      "compare",
      "comparison",
      "vergleich",
      "comparar",
      "comparación",
      "comparatif",
      "comparaison",
      "best",
      "beste",
      "besten",
      "bester",
      "mejor",
      "mejores",
      "meilleur",
      "meilleure",
      "meilleurs",
    ],
  },
  {
    section: "pricing",
    terms: [
      "pricing",
      "price",
      "prices",
      "cost",
      "costs",
      "preis",
      "preise",
      "kosten",
      "precio",
      "precios",
      "prix",
      "tarif",
      "tarifs",
    ],
  },
  {
    section: "reviews",
    terms: [
      "review",
      "reviews",
      "erfahrungen",
      "bewertung",
      "bewertungen",
      "opiniones",
      "reseñas",
      "avis",
    ],
  },
];
/**
 * Phrases that contain a buying word without buying intent: how-tos, product
 * names and finance terms. Removed before a query is classified.
 */
export const GSC_NOT_BUYING_INTENT_PHRASES = [
  "best practice",
  "best practices",
  "best buy",
  "best of breed",
  "best in class",
  "best-in-class",
  "vs code",
  "code review",
  "code reviews",
  "peer review",
  "pull request review",
  "cost of living",
  "stock price",
  "stock prices",
  "share price",
  "price action",
];
/**
 * A price or review word after at most this many words usually names one
 * product ("acme pricing"). An assistant answers those from that product's
 * own page, so they get no boost.
 */
export const GSC_SINGLE_PRODUCT_MAX_WORDS = 2;
/** Words that may follow a single product's price or review word: "acme pricing plans 2026". */
export const GSC_SINGLE_PRODUCT_TRAILING_WORDS = ["plan", "plans", "reddit"];
export const GSC_SINGLE_PRODUCT_SECTIONS: readonly GscBuyingIntentSection[] = [
  "pricing",
  "reviews",
];
/** Words that make a short query a category search ("crm software pricing"), not one product. */
export const GSC_CATEGORY_WORDS = [
  "software",
  "tool",
  "tools",
  "app",
  "apps",
  "platform",
  "platforms",
  "service",
  "services",
  "solution",
  "solutions",
  "system",
  "systems",
  "plugin",
  "plugins",
  "provider",
  "providers",
  "saas",
  "anbieter",
  "programm",
  "programme",
  "logiciel",
  "logiciels",
  "outil",
  "outils",
  "herramienta",
  "herramientas",
];
/** Opportunity multiplier for buying-intent queries. */
export const GSC_BUYING_INTENT_WEIGHT = 1.5;
/** Head terms that share this many leading words count as one intent. */
export const GSC_QUERY_CLUSTER_WORDS = 3;
/** Near-duplicate queries of one head term that may reach the model. */
export const GSC_QUERY_CLUSTER_CAP = 3;
export const GSC_SUGGESTIONS_MAX_PER_SYNC = 15;
export const GSC_MAX_KEYWORDS_PER_SUGGESTION = 8;
export const GSC_SUGGESTION_MODEL = UTILITY_MODEL_ID;
export const GSC_SUGGESTION_MAX_TOKENS = 3000;
export const GSC_SCHEDULE_ID_PREFIX = "gsc-sync-";
