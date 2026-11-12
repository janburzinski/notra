import { createServerFlagsManager } from "@databuddy/sdk/node";
import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
} from "@tanstack/react-start/server";
import { readRequestConsent } from "c15t/server";

import {
  LANDING_FLAGS_TIMEOUT_MS,
  LANDING_VISITOR_COOKIE,
  LANDING_VISITOR_COOKIE_MAX_AGE_SECONDS,
  LANDING_VISITOR_ID_PREFIX,
} from "@/constants/landing/flags";
import {
  HERO_CONTROL_VARIANT,
  HERO_EXPERIMENT_FLAG,
  HERO_VARIANTS,
} from "@/constants/landing/hero";
import { LANDING_TESTIMONIALS_FLAG_KEY } from "@/constants/landing/testimonials";
import type { LandingFlags } from "@/types/landing/flags";

const DEFAULT_FLAGS: LandingFlags = {
  enrolled: false,
  heroVariant: HERO_CONTROL_VARIANT,
  testimonials: false,
};

function hasMeasurementConsent(request: Request): boolean {
  const { state } = readRequestConsent({
    adapter: "@c15t/tanstack-start",
    request: { headers: request.headers, url: request.url },
  });
  return state.initialRecords?.choice?.categories?.measurement?.value === true;
}

function visitorId(): string {
  const existing = getCookie(LANDING_VISITOR_COOKIE);
  if (existing?.startsWith(LANDING_VISITOR_ID_PREFIX)) {
    return existing;
  }
  const id = `${LANDING_VISITOR_ID_PREFIX}${crypto.randomUUID()}`;
  setCookie(LANDING_VISITOR_COOKIE, id, {
    httpOnly: true,
    maxAge: LANDING_VISITOR_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}

const clientId = import.meta.env.NEXT_PUBLIC_DATABUDDY_WEB_WEBSITE_ID;

const flagsManager = clientId ? createServerFlagsManager({ clientId }) : null;

function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), LANDING_FLAGS_TIMEOUT_MS);
    }),
  ]).catch(() => null);
}

export const getLandingFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<LandingFlags> => {
    if (!(flagsManager && hasMeasurementConsent(getRequest()))) {
      if (getCookie(LANDING_VISITOR_COOKIE)) {
        deleteCookie(LANDING_VISITOR_COOKIE, { path: "/" });
      }
      return DEFAULT_FLAGS;
    }

    const user = { userId: visitorId() };
    const [hero, testimonials] = (await withTimeout(
      Promise.all([
        flagsManager.getFlag(HERO_EXPERIMENT_FLAG, user),
        flagsManager.getFlag(LANDING_TESTIMONIALS_FLAG_KEY, user),
      ])
    )) ?? [null, null];
    if (!hero || hero.reason === "ERROR") {
      return DEFAULT_FLAGS;
    }

    const variant = hero.variant;
    return {
      enrolled: true,
      heroVariant:
        variant && HERO_VARIANTS[variant] ? variant : HERO_CONTROL_VARIANT,
      testimonials: testimonials?.enabled === true,
    };
  }
);
