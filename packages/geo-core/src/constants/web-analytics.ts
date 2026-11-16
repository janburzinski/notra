import type { WebUtmDimension } from "../types/geo";
import type { WebAndroidAppReferrer } from "../types/ingest";

export const WEB_SESSION_TTL_SECONDS = 30 * 60;
export const WEB_SESSION_KEY_PREFIX = "web:session";
export const WEB_VISITOR_ID_LENGTH = 16;
export const WEB_UTM_MAX_LENGTH = 100;
/** The UTM parameters web analytics reports on, in the order the tabs show them. */
export const WEB_UTM_DIMENSIONS = [
  "source",
  "medium",
  "campaign",
  "term",
  "content",
] as const;
/** UTM parameters only the raw page views keep, not web_sources_daily. */
export const WEB_UTM_RAW_ONLY_DIMENSIONS: readonly WebUtmDimension[] = [
  "term",
  "content",
];
export const WEB_UTM_CAMPAIGN_MAX_LENGTH = 200;

/**
 * A path-like hash route (`#/pricing`, `#!/pricing`), cut before its query or
 * anything that is not a path character, so `#access_token=…` never matches.
 */
export const WEB_HASH_ROUTE_PATTERN = /^#!?\/[\w\-.~%@:+,/]+/;
export const WEB_HASH_ROUTE_MAX_LENGTH = 256;

/** Primary subtag of the first Accept-Language entry, e.g. "de" from "de-DE,de;q=0.9". */
export const WEB_LANGUAGE_PATTERN = /^\s*([a-z]{2,3})(?:[-_;,\s]|$)/i;

/**
 * Automation that runs a real browser engine, so it passes the client-hint
 * check but is not a person. Web visits only; AI classification is separate.
 */
export const WEB_AUTOMATION_UA_PATTERNS: readonly string[] = [
  "headlesschrome",
  "phantomjs",
  "chrome-lighthouse",
  "pagespeed",
  "prerender",
];

/** The `web_events` name of an outbound link click, the only event stored. */
export const WEB_OUTBOUND_EVENT = "Outbound";

/** Caps for notra.plus.js error reports; messages are scrubbed before storage. */
export const WEB_ERROR_MESSAGE_MAX_LENGTH = 300;

/** Upper bounds that drop obviously broken vitals instead of skewing p75. */
export const WEB_VITAL_TIMING_MAX_MS = 120_000;
export const WEB_VITAL_INP_MAX_MS = 60_000;
export const WEB_VITAL_CLS_MAX_MILLI = 100_000;
export const WEB_VITAL_METRICS = ["lcp", "inp", "cls", "fcp", "ttfb"] as const;

export const WEB_DEFAULT_DAYS = 30;
export const WEB_PAGES_LIMIT = 50;
export const WEB_SOURCES_LIMIT = 25;
export const WEB_BREAKDOWN_LIMIT = 8;

export const WEB_MACHINE_PATH_PATTERN =
  /(?:\.md|\.txt|\.xml|\.json)$|^\/(?:robots\.txt|sitemap[^/]*|llms(?:-full)?\.txt|feed\.xml)$/i;

export const WEB_AI_PRODUCTS: Record<string, string> = {
  chatgpt: "openai",
  openai: "openai",
  claude: "anthropic",
  perplexity: "perplexity",
  gemini: "google",
  copilot: "microsoft",
  grok: "xai",
  deepseek: "deepseek",
  mistral: "mistral",
  you: "you",
  qwen: "alibaba",
  meta: "meta",
  phind: "phind",
};

/**
 * Webmail, checked before search so `google.` does not catch Gmail. There is
 * no email group, so these stay under other with a readable source.
 */
export const WEB_MAIL_HOSTS: Record<string, string> = {
  "mail.google.com": "gmail",
  "inbox.google.com": "gmail",
  "mail.yahoo.com": "yahoo-mail",
  "outlook.live.com": "outlook",
  "outlook.office.com": "outlook",
  "outlook.office365.com": "outlook",
};

/**
 * Sign-in and checkout pages that send a visitor back mid-visit. They are
 * not where a visit came from, so a return from one never opens a session
 * (as a referral exclusion in other analytics tools).
 */
export const WEB_RETURN_HOSTS: readonly string[] = [
  "accounts.google.com",
  "accounts.youtube.com",
  "login.microsoftonline.com",
  "login.live.com",
  "appleid.apple.com",
  "checkout.stripe.com",
  "billing.stripe.com",
  "paypal.com",
];

/**
 * What may follow `google.` or `yandex.` in a search host: a TLD, or a
 * second-level one such as `co.uk` or `com.tr`. Not `google.evil.example`.
 */
export const WEB_SEARCH_SUFFIX_PATTERN =
  /^(?:[a-z]{2,6}|(?:co|com|org|net|ac|gov|edu)\.[a-z]{2})$/;

export const WEB_SEARCH_HOSTS: Record<string, string> = {
  "google.": "google",
  "bing.com": "bing",
  "duckduckgo.com": "duckduckgo",
  "search.yahoo.com": "yahoo",
  "yahoo.com": "yahoo",
  "ecosia.org": "ecosia",
  "search.brave.com": "brave",
  "kagi.com": "kagi",
  "yandex.": "yandex",
  "baidu.com": "baidu",
  "startpage.com": "startpage",
  "qwant.com": "qwant",
};

export const WEB_SOCIAL_HOSTS: Record<string, string> = {
  "t.co": "x",
  "x.com": "x",
  "twitter.com": "x",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "reddit.com": "reddit",
  "news.ycombinator.com": "hacker-news",
  "youtube.com": "youtube",
  "threads.net": "threads",
  "bsky.app": "bluesky",
  "mastodon.social": "mastodon",
  "github.com": "github",
  "producthunt.com": "product-hunt",
  "medium.com": "medium",
  "substack.com": "substack",
  "slack.com": "slack",
  "slack-redir.net": "slack",
  "discord.com": "discord",
  "discord.gg": "discord",
  "telegram.org": "telegram",
  "t.me": "telegram",
  "whatsapp.com": "whatsapp",
  "wa.me": "whatsapp",
};

/** Chrome reports a link opened from an Android app as `android-app://<package>/`. */
export const WEB_ANDROID_APP_PROTOCOL = "android-app:";
export const WEB_ANDROID_PACKAGE_PATTERN = /^[a-z]\w*(?:\.[a-z]\w*)+$/;

/**
 * Android apps by package name, lowercased; AI apps are in GEO_AI_ANDROID_APPS.
 * Sources and groups match the apps' websites above.
 */
export const WEB_ANDROID_APP_REFERRERS: Record<string, WebAndroidAppReferrer> =
  {
    "com.google.android.googlequicksearchbox": {
      group: "search",
      source: "google",
    },
    "com.google.android.gm": { group: "other", source: "gmail" },
    "com.twitter.android": { group: "social", source: "x" },
    "com.linkedin.android": { group: "social", source: "linkedin" },
    "com.facebook.katana": { group: "social", source: "facebook" },
    "com.facebook.lite": { group: "social", source: "facebook" },
    "com.instagram.android": { group: "social", source: "instagram" },
    "com.instagram.barcelona": { group: "social", source: "threads" },
    "com.reddit.frontpage": { group: "social", source: "reddit" },
    "com.google.android.youtube": { group: "social", source: "youtube" },
    "xyz.blueskyweb.app": { group: "social", source: "bluesky" },
    "org.joinmastodon.android": { group: "social", source: "mastodon" },
    "com.github.android": { group: "social", source: "github" },
    "com.medium.reader": { group: "social", source: "medium" },
    "com.slack": { group: "social", source: "slack" },
    "com.discord": { group: "social", source: "discord" },
    "org.telegram.messenger": { group: "social", source: "telegram" },
    "com.whatsapp": { group: "social", source: "whatsapp" },
  };

export const WEB_BROWSERS: readonly [string, string][] = [
  ["edg/", "Edge"],
  ["opr/", "Opera"],
  ["samsungbrowser/", "Samsung Internet"],
  ["firefox/", "Firefox"],
  ["fxios/", "Firefox"],
  ["crios/", "Chrome"],
  ["chrome/", "Chrome"],
  ["safari/", "Safari"],
];

export const WEB_OPERATING_SYSTEMS: readonly [string, string][] = [
  ["iphone", "iOS"],
  ["ipad", "iPadOS"],
  ["android", "Android"],
  ["windows", "Windows"],
  ["mac os x", "macOS"],
  ["cros", "ChromeOS"],
  ["linux", "Linux"],
];

export const ISO_DATE_LENGTH = 10;
/** Longest date range a web analytics report covers, in days. */
export const ANALYTICS_MAX_RANGE_DAYS = 366;
/** Largest value the UInt32 web columns (visible time, error line) hold. */
export const WEB_UINT32_MAX = 4_294_967_295;

/** What a path segment that looks like personal data or an id becomes. */
export const WEB_PATH_ID_PLACEHOLDER = ":id";
export const WEB_PATH_EMAIL_PATTERN = /[^/@]+(?:@|%40)[^/@.]+\.[a-z]{2,}/i;
export const WEB_PATH_UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export const WEB_PATH_DIGIT_RUN_PATTERN = /\d{4,}/;
/** Token-like: 20+ characters of id alphabet with a long unbroken run. */
export const WEB_PATH_TOKEN_SEGMENT_PATTERN = /^[\w.~-]{20,}$/;
export const WEB_PATH_TOKEN_RUN_PATTERN = /[A-Za-z0-9]{16,}/g;
/** Separators, base64 padding and percent escapes a token may contain. */
export const WEB_PATH_TOKEN_FILLER_PATTERN = /[-_.~=+]|%[0-9a-f]{2}/gi;
export const WEB_PATH_TOKEN_MIN_LENGTH = 16;
/**
 * Random text switches between lowercase, uppercase and digits about every
 * other character; words, CamelCase included, rarely do.
 */
export const WEB_PATH_TOKEN_MIN_CLASS_CHANGES = 0.3;
/** Above this, text switches so often it is random even if it has vowels. */
export const WEB_PATH_TOKEN_SURE_CLASS_CHANGES = 0.55;
/** Words are about 40% vowels, random letters about 20%. */
export const WEB_PATH_WORD_MIN_VOWELS = 0.3;
