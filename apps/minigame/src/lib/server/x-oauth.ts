import {
  X_AUTHORIZE_URL,
  X_ME_URL,
  X_REVOKE_URL,
  X_SCOPES,
  X_TOKEN_URL,
} from "@/constants/server";
import { xTokenSchema, xUserSchema } from "@/schemas/api";
import type { Company, PlayerProfile, XAffiliation } from "@/types/leaderboard";
import { toBase64Url } from "@/utils/base64url";

interface XClient {
  clientId: string;
  clientSecret: string;
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return toBase64Url(new Uint8Array(digest));
}

export function authorizeUrl(
  client: XClient,
  redirectUri: string,
  state: string,
  challenge: string
) {
  const url = new URL(X_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: redirectUri,
    scope: X_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

function basicAuth(client: XClient) {
  return `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`;
}

async function revoke(client: XClient, accessToken: string) {
  const response = await fetch(X_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(client),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      token: accessToken,
      token_type_hint: "access_token",
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) {
    console.warn("[minigame] could not revoke an X token", response?.status);
  }
}

/** The company on an X affiliation badge, keyed by the organisation's account. */
function companyFrom(affiliation: XAffiliation | undefined): Company | null {
  const id = affiliation?.user_id?.[0];
  const name = affiliation?.description?.trim().slice(0, 80);
  if (!(id && name)) {
    return null;
  }
  const https = (value: string | undefined) =>
    value?.startsWith("https://") ? value : null;
  return {
    id,
    name,
    badge: https(affiliation?.badge_url),
    url: https(affiliation?.url),
  };
}

/**
 * Swaps the code for a token, reads the account once and revokes the token before answering: the
 * game only needs to know who you are, so it keeps no X access.
 */
export async function signInWithX(
  client: XClient,
  code: string,
  verifier: string,
  redirectUri: string
): Promise<PlayerProfile | null> {
  const tokenResponse = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(client),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: client.clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) {
    return null;
  }
  const token = xTokenSchema.safeParse(
    await tokenResponse.json().catch(() => null)
  );
  if (!token.success) {
    return null;
  }
  const accessToken = token.data.access_token;
  try {
    const meResponse = await fetch(X_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!meResponse.ok) {
      return null;
    }
    const me = xUserSchema.safeParse(await meResponse.json().catch(() => null));
    if (!me.success) {
      return null;
    }
    const { id, name, username, profile_image_url, affiliation } = me.data.data;
    return {
      id,
      handle: username,
      name,
      avatar: profile_image_url ?? null,
      company: companyFrom(affiliation),
    };
  } finally {
    // awaited: a serverless host may stop work left running after the response
    await revoke(client, accessToken);
  }
}
