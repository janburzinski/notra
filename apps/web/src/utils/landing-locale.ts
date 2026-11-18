import {
  DEFAULT_LANDING_LOCALE,
  LANDING_FORCE_ENGLISH_PATH,
  LANDING_HOME_PATHS,
  LANDING_LOCALE_COOKIE,
  LANDING_LOCALE_COOKIE_MAX_AGE,
  LANDING_LOCALES,
} from "../constants/i18n.js";
import type { LandingLocale } from "../types/i18n.js";

function isLandingLocale(value: unknown): value is LandingLocale {
  return LANDING_LOCALES.some((locale) => locale === value);
}

export function localeFromPathname(pathname: string): LandingLocale {
  return pathname === LANDING_HOME_PATHS.de ||
    pathname.startsWith(`${LANDING_HOME_PATHS.de}/`)
    ? "de"
    : DEFAULT_LANDING_LOCALE;
}

function negotiateLandingLocale(acceptLanguage: string | null): LandingLocale {
  if (!acceptLanguage) {
    return DEFAULT_LANDING_LOCALE;
  }
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      return {
        language:
          tag === "*"
            ? DEFAULT_LANDING_LOCALE
            : (tag.toLowerCase().split("-")[0] ?? ""),
        quality: quality ? Number(quality.slice(2)) : 1,
      };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality);
  const match = ranked.find(({ language }) => isLandingLocale(language));
  return match && isLandingLocale(match.language)
    ? match.language
    : DEFAULT_LANDING_LOCALE;
}

function readLocaleCookie(cookieHeader: string | null) {
  const value = cookieHeader
    ?.split(";")
    .map((pair) => pair.trim().split("="))
    .find(([name]) => name === LANDING_LOCALE_COOKIE)?.[1];
  return isLandingLocale(value) ? value : undefined;
}

function localeCookie(locale: LandingLocale, secure: boolean) {
  return `${LANDING_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LANDING_LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function rememberLandingLocale(locale: LandingLocale) {
  document.cookie = localeCookie(locale, window.location.protocol === "https:");
}

export function preferredLandingLocale() {
  return (
    readLocaleCookie(document.cookie) ??
    negotiateLandingLocale(navigator.languages.join(","))
  );
}

function localeRedirect(url: URL, pathname: string, cookie?: string) {
  const headers = new Headers({
    Location: `${pathname}${url.search}`,
    "Cache-Control": "private, no-store",
  });
  if (cookie) {
    headers.set("Set-Cookie", cookie);
  }
  return new Response(null, { status: 307, headers });
}

export function landingLocaleRedirect(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === LANDING_FORCE_ENGLISH_PATH) {
    return localeRedirect(
      url,
      LANDING_HOME_PATHS.en,
      localeCookie("en", url.protocol === "https:")
    );
  }
  if (url.pathname !== LANDING_HOME_PATHS.en || request.method !== "GET") {
    return;
  }
  const locale =
    readLocaleCookie(request.headers.get("cookie")) ??
    negotiateLandingLocale(request.headers.get("accept-language"));
  if (locale === "de") {
    return localeRedirect(url, LANDING_HOME_PATHS.de);
  }
}
