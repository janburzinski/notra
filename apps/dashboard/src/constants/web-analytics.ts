import {
  ComputerIcon,
  SmartPhone01Icon,
  Tablet01Icon,
} from "@hugeicons/core-free-icons";
import { DuckDuckGo } from "@notra/ui/components/ui/svgs/duckDuckGo";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Google } from "@notra/ui/components/ui/svgs/google";
import { Instagram } from "@notra/ui/components/ui/svgs/instagram";
import { Kagi } from "@notra/ui/components/ui/svgs/kagi";
import { Linkedin } from "@notra/ui/components/ui/svgs/linkedin";
import { Reddit } from "@notra/ui/components/ui/svgs/reddit";
import { XTwitter } from "@notra/ui/components/ui/svgs/twitter";
import { Youtube } from "@notra/ui/components/ui/svgs/youtube";
import type { ComponentType, SVGProps } from "react";

import type { WebVitalRating, WebVitalsDeviceFilter } from "@/types/geo";

export const WEB_TREND_PEOPLE_KEY = "people";
export const WEB_TREND_AGENTS_KEY = "agents";

export const WEB_REFERRER_LOGOS: Partial<
  Record<string, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  google: Google,
  duckduckgo: DuckDuckGo,
  kagi: Kagi,
  github: Github,
  instagram: Instagram,
  linkedin: Linkedin,
  reddit: Reddit,
  x: XTwitter,
  youtube: Youtube,
};

/** Site whose favicon stands in for a known referrer without a bundled logo. */
export const WEB_SOURCE_DOMAINS: Readonly<Record<string, string>> = {
  bing: "bing.com",
  yahoo: "yahoo.com",
  ecosia: "ecosia.org",
  brave: "search.brave.com",
  yandex: "yandex.com",
  baidu: "baidu.com",
  startpage: "startpage.com",
  qwant: "qwant.com",
  facebook: "facebook.com",
  "hacker-news": "news.ycombinator.com",
  threads: "threads.net",
  bluesky: "bsky.app",
  mastodon: "joinmastodon.org",
  "product-hunt": "producthunt.com",
  medium: "medium.com",
  substack: "substack.com",
};

/** A referrer stored as its host (`dominikkoch.dev`), not a display name. */
export const WEB_SOURCE_HOST_PATTERN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

export const WEB_DEVICE_ICONS: Record<string, typeof ComputerIcon> = {
  desktop: ComputerIcon,
  mobile: SmartPhone01Icon,
  tablet: Tablet01Icon,
};

export const WEB_LIST_LIMIT = 8;
/** Requested favicon size: twice the 14px icon for sharp HiDPI rendering. */
export const WEB_OUTBOUND_FAVICON_SIZE = 32;

export const WEB_VITAL_RATINGS = [
  "good",
  "needs-improvement",
  "poor",
] as const satisfies readonly WebVitalRating[];

/** Fill of a rating's dot and distribution segment. */
export const WEB_VITAL_RATING_FILL_CLASS: Record<WebVitalRating, string> = {
  good: "bg-emerald-500",
  "needs-improvement": "bg-amber-500",
  poor: "bg-red-500",
};

export const WEB_VITAL_RATING_TEXT_CLASS: Record<WebVitalRating, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  "needs-improvement": "text-amber-700 dark:text-amber-400",
  poor: "text-red-700 dark:text-red-400",
};

export const WEB_VITALS_DEVICE_FILTERS = [
  "all",
  "mobile",
  "desktop",
] as const satisfies readonly WebVitalsDeviceFilter[];

/**
 * Flag shown beside a browser language. The stored value is only the primary
 * subtag, so each language gets the flag of the country it originates from
 * (en: United Kingdom, pt: Portugal, es: Spain, zh: China); languages
 * without one country of origin use the country with the most native
 * speakers (ar: Egypt, sw: Tanzania). Unlisted languages show a globe.
 */
export const WEB_LANGUAGE_FLAG_COUNTRIES: Readonly<Record<string, string>> = {
  af: "ZA",
  ar: "EG",
  az: "AZ",
  be: "BY",
  bg: "BG",
  bn: "BD",
  bs: "BA",
  ca: "AD",
  cs: "CZ",
  cy: "GB",
  da: "DK",
  de: "DE",
  el: "GR",
  en: "GB",
  es: "ES",
  et: "EE",
  fa: "IR",
  fi: "FI",
  fil: "PH",
  fr: "FR",
  ga: "IE",
  he: "IL",
  hi: "IN",
  hr: "HR",
  hu: "HU",
  hy: "AM",
  id: "ID",
  is: "IS",
  it: "IT",
  ja: "JP",
  ka: "GE",
  kk: "KZ",
  km: "KH",
  ko: "KR",
  lt: "LT",
  lv: "LV",
  mk: "MK",
  mn: "MN",
  ms: "MY",
  mt: "MT",
  my: "MM",
  nb: "NO",
  ne: "NP",
  nl: "NL",
  nn: "NO",
  no: "NO",
  pl: "PL",
  pt: "PT",
  ro: "RO",
  ru: "RU",
  si: "LK",
  sk: "SK",
  sl: "SI",
  sq: "AL",
  sr: "RS",
  sv: "SE",
  sw: "TZ",
  ta: "LK",
  th: "TH",
  tl: "PH",
  tr: "TR",
  uk: "UA",
  ur: "PK",
  uz: "UZ",
  vi: "VN",
  zh: "CN",
};
export const WEB_OUTCOMES_SKELETON_ROWS = 3;

export const WEB_TABLE_ROW_HEIGHT = 44;
export const WEB_TABLE_MIN_ROWS = 3;
export const WEB_TABLE_EMPTY_HEIGHT = 340;

export const WEB_SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  yahoo: "Yahoo",
  ecosia: "Ecosia",
  brave: "Brave Search",
  kagi: "Kagi",
  yandex: "Yandex",
  baidu: "Baidu",
  startpage: "Startpage",
  qwant: "Qwant",
  x: "X",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
  "hacker-news": "Hacker News",
  youtube: "YouTube",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  github: "GitHub",
  "product-hunt": "Product Hunt",
  medium: "Medium",
  substack: "Substack",
};
