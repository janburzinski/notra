import { geoLog } from "@notra/ai/evlog";
import { db } from "@notra/db/drizzle";
import { members, organizations } from "@notra/db/schema";
import { GeoTokenRotationEmail } from "@notra/email/emails/geo-token-rotation";
import { isBrewConfigured, sendBrewEmail } from "@notra/email/utils/brew";
import { and, eq, inArray } from "drizzle-orm";

import {
  GEO_INGEST_LEGACY_SECRET_CHECK_INTERVAL_SECONDS,
  GEO_INGEST_LEGACY_SECRET_DEADLINE,
  GEO_INGEST_LEGACY_SECRET_EMAILED_KEY_PREFIX,
  GEO_INGEST_LEGACY_SECRET_EMAILED_TTL_SECONDS,
  GEO_INGEST_LEGACY_SECRET_RECIPIENT_ROLES,
} from "../constants/ingest";
import { getGeoIngestTokenGeneration } from "../geo/ingest";
import type { GeoIngestIdentity } from "../types/geo";
import type { GeoIngestLegacySecretOutcome } from "../types/ingest";
import { logGeoFailure } from "../utils/geo-log";
import { geoIngestRedis } from "./ratelimit";

const recentlyChecked = new Map<string, number>();

async function claim(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await geoIngestRedis.set(key, 1, {
    nx: true,
    ex: ttlSeconds,
  });
  return result === "OK";
}

async function sendRotationEmails(
  organizationId: string
): Promise<GeoIngestLegacySecretOutcome> {
  const [organization, recipients] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { name: true, slug: true },
    }),
    db.query.members.findMany({
      where: and(
        eq(members.organizationId, organizationId),
        inArray(members.role, GEO_INGEST_LEGACY_SECRET_RECIPIENT_ROLES)
      ),
      with: { users: { columns: { email: true } } },
    }),
  ]);
  if (!organization || recipients.length === 0) {
    return { outcome: "no_recipients", recipients: 0 };
  }

  const results = await Promise.all(
    recipients.map(({ users }) =>
      sendBrewEmail({
        category: "geo-token-rotation",
        to: users.email,
        subject: "Please rotate your Notra tracking token",
        react: GeoTokenRotationEmail({
          organizationName: organization.name,
          organizationSlug: organization.slug,
          deadline: GEO_INGEST_LEGACY_SECRET_DEADLINE,
        }),
        idempotencyKey: `geo-token-rotation:${organizationId}:${users.email}`,
      })
    )
  );
  const errors = results.flatMap((result) =>
    result.error ? [result.error] : []
  );
  const [firstError] = errors;
  if (firstError) {
    return {
      outcome: "failed",
      recipients: recipients.length,
      failed: errors.length,
      errorMessage: `${firstError.name}: ${firstError.message}`,
      status: firstError.status,
    };
  }
  return { outcome: "emailed", recipients: recipients.length };
}

async function emailOrganization(
  organizationId: string
): Promise<GeoIngestLegacySecretOutcome> {
  if (!isBrewConfigured()) {
    return { outcome: "brew_not_configured" };
  }
  const emailedKey = `${GEO_INGEST_LEGACY_SECRET_EMAILED_KEY_PREFIX}:${organizationId}`;
  if (
    !(await claim(emailedKey, GEO_INGEST_LEGACY_SECRET_EMAILED_TTL_SECONDS))
  ) {
    return { outcome: "already_emailed" };
  }
  let result: GeoIngestLegacySecretOutcome = { outcome: "failed" };
  try {
    result = await sendRotationEmails(organizationId);
    return result;
  } finally {
    if (result.outcome === "failed") {
      await geoIngestRedis.del(emailedKey);
    }
  }
}

async function checkLegacySecret({
  organizationId,
  projectId,
  generation,
}: GeoIngestIdentity): Promise<GeoIngestLegacySecretOutcome> {
  const activeGeneration = await getGeoIngestTokenGeneration(
    organizationId,
    projectId
  );
  if (activeGeneration !== generation) {
    return { outcome: "revoked", activeGeneration, generation };
  }
  return emailOrganization(organizationId);
}

/**
 * Emails owners and admins once when an active token still verifies against a
 * previous ingest secret. Each token scope is checked at most once a minute per
 * process, and every check logs its outcome.
 */
export async function notifyGeoIngestLegacySecret(
  identity: GeoIngestIdentity
): Promise<void> {
  const { organizationId, projectId, generation } = identity;
  const scope = `${organizationId}:${projectId ?? ""}:${generation}`;
  const now = Date.now();
  if ((recentlyChecked.get(scope) ?? 0) > now) {
    return;
  }
  recentlyChecked.set(
    scope,
    now + GEO_INGEST_LEGACY_SECRET_CHECK_INTERVAL_SECONDS * 1000
  );
  try {
    const result = await checkLegacySecret(identity);
    const level = result.outcome === "failed" ? "error" : "info";
    geoLog[level]({
      event: "geo.ingest.legacy_secret",
      organizationId,
      projectId,
      ...result,
    });
  } catch (error) {
    logGeoFailure(
      "geo.ingest.legacy_secret",
      "Legacy ingest secret check failed",
      error,
      { organizationId, projectId, outcome: "error" }
    );
  }
}
