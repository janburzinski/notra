import freeEmailDomains from "free-email-domains";

import reservedBrandSlugs from "./reserved-brand-slugs.json";

export const SITE_PROTECTED_SLUG_WORDS: ReadonlySet<string> = new Set([
  "notra",
  "usenotra",
]);

export const SITE_SIGN_IN_SLUG_WORDS: ReadonlySet<string> = new Set([
  "2fa",
  "auth",
  "authenticate",
  "authentication",
  "log-in",
  "login",
  "logon",
  "mfa",
  "oauth",
  "openid",
  "otp",
  "passwd",
  "password",
  "sign-in",
  "sign-on",
  "signin",
  "signon",
  "sso",
  "verification",
  "verify",
]);

/** Words an automatic address leaves out, since the address check rejects them. */
export const SITE_SLUG_BLOCKED_WORDS: ReadonlySet<string> = new Set([
  ...SITE_PROTECTED_SLUG_WORDS,
  ...SITE_SIGN_IN_SLUG_WORDS,
]);

/**
 * Each slug maps to the domains that prove ownership of it. An empty list
 * means only a staff grant unlocks the slug.
 */
export const SITE_RESERVED_BRAND_SLUGS: Readonly<
  Record<string, readonly string[]>
> = reservedBrandSlugs;

/**
 * Anyone can sign up at these, so a mailbox there proves nothing. The
 * package is a maintained list with regional aliases such as yahoo.co.jp;
 * the extras are missing from it.
 */
export const SITE_FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  ...freeEmailDomains,
  "hey.com",
  "tutanota.com",
]);

/**
 * Ordinary words that happen to be a popular site's name. Teams name blogs
 * after them, and the name alone doesn't point to one company.
 */
export const SITE_GENERIC_BRAND_WORDS: ReadonlySet<string> = new Set([
  "about",
  "action",
  "auto",
  "base",
  "calculator",
  "change",
  "clean",
  "cloud",
  "code",
  "customer",
  "dev",
  "dictionary",
  "digital",
  "domain",
  "education",
  "fast",
  "football",
  "found",
  "free",
  "goal",
  "guard",
  "here",
  "history",
  "home",
  "hybrid",
  "impact",
  "index",
  "kit",
  "legacy",
  "line",
  "media",
  "mobile",
  "name",
  "net",
  "news",
  "next",
  "note",
  "one",
  "people",
  "platform",
  "playground",
  "real",
  "reference",
  "resume",
  "run",
  "schema",
  "science",
  "script",
  "service",
  "shop",
  "simply",
  "site",
  "space",
  "spec",
  "sport",
  "sports",
  "standard",
  "stuff",
  "test",
  "time",
  "today",
  "tracker",
  "weather",
  "web",
]);

export const SITE_NAME_REJECTION_MESSAGES = {
  granted:
    "This address is reserved for another organization. Pick a different one.",
  protected:
    "Addresses containing “notra” are reserved for Notra. Pick a different one.",
  signIn:
    "Addresses with sign-in words like “login” or “auth” look like login pages. Pick a different one.",
  offensive: "This name isn't allowed on Notra Sites. Pick a different one.",
  impersonation:
    "This name looks like another organization or a login page. Use your own organization's name.",
} as const;

export const GENERIC_TLDS = new Set([
  "app",
  "biz",
  "co",
  "com",
  "dev",
  "gg",
  "info",
  "io",
  "ai",
  "me",
  "net",
  "org",
  "sh",
  "so",
  "tv",
  "xyz",
]);
