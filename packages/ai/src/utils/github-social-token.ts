import type { socialConnections } from "@notra/db/schema";
import { decryptToken } from "@notra/db/utils/integration-encryption";

export function resolveGitHubSocialToken(
  connection: Pick<
    typeof socialConnections.$inferSelect,
    "encryptedAccessToken"
  >
) {
  return connection.encryptedAccessToken
    ? decryptToken(connection.encryptedAccessToken)
    : null;
}

/** GitHub App user tokens expire after a few hours; sign-in tokens have no expiry. */
export function isGitHubSocialTokenExpired(
  expiresAt: Date | null | undefined,
  now = new Date()
) {
  return Boolean(expiresAt && expiresAt <= now);
}
