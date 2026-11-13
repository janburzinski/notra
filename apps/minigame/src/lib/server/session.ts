import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
} from "@tanstack/react-start/server";

import {
  DEV_PLAYER,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
} from "@/constants/server";
import { devPlayerEnabled, isProduction } from "@/lib/server/config";
import { readSignedValue, signValue } from "@/lib/server/signed-cookie";
import { sessionPayloadSchema } from "@/schemas/api";
import type { PlayerProfile, SessionPayload } from "@/types/leaderboard";

export async function readSession(): Promise<PlayerProfile | null> {
  const session = await readSignedValue<SessionPayload>(
    getCookie(SESSION_COOKIE),
    sessionPayloadSchema
  );
  if (!session) {
    return devPlayerEnabled(getRequest()) ? DEV_PLAYER : null;
  }
  return {
    id: session.id,
    handle: session.handle,
    name: session.name,
    avatar: session.avatar,
    company: session.company,
  };
}

export async function startSession(player: PlayerProfile) {
  const value = await signValue({
    ...player,
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  });
  if (!value) {
    return false;
  }
  setCookie(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return true;
}

export function endSession() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}
