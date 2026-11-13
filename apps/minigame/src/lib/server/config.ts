const DEV_SESSION_SECRET =
  "minigame-local-development-secret-not-for-production";

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** The secret that signs session and OAuth cookies; a fixed one outside production. */
export function sessionSecret() {
  const secret = process.env.MINIGAME_SESSION_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  return isProduction() ? null : DEV_SESSION_SECRET;
}

export function xOAuthConfig() {
  const clientId = process.env.MINIGAME_X_CLIENT_ID;
  const clientSecret = process.env.MINIGAME_X_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * Moderators, by X user id, from MINIGAME_ADMIN_IDS (comma separated). The local dev players count as
 * moderators too, so moderation can be tried out; they never exist in production.
 */
export function isAdmin(playerId: string) {
  const ids = (process.env.MINIGAME_ADMIN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return (
    ids.includes(playerId) || (!isProduction() && playerId.startsWith("dev-"))
  );
}

/** The public origin, which X's callback URL must match exactly. */
export function publicOrigin(request: Request) {
  return (
    process.env.MINIGAME_URL?.replace(/\/$/, "") ?? new URL(request.url).origin
  );
}

function isLoopback(request: Request) {
  const { hostname } = new URL(request.url);
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

/** Local development on this machine: never in a production build or off loopback. */
export function devLoginEnabled(request: Request) {
  return !isProduction() && isLoopback(request);
}

/**
 * Locally, without an X app configured, every visitor plays as the dev player, so scores save with
 * no sign-in at all. MINIGAME_DEV_PLAYER=off turns it off to try the guest flow.
 */
export function devPlayerEnabled(request: Request) {
  return (
    devLoginEnabled(request) &&
    xOAuthConfig() === null &&
    process.env.MINIGAME_DEV_PLAYER !== "off"
  );
}
