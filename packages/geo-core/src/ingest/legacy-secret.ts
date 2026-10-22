import { geoLog } from "@notra/ai/evlog";
import { db } from "@notra/db/drizzle";
import { members, organizations } from "@notra/db/schema";
import { GeoTokenRotationEmail } from "@notra/email/emails/geo-token-rotation";
import { sendBrewEmail } from "@notra/email/utils/brew";
import { and, eq, inArray } from "drizzle-orm";

import {
  GEO_INGEST_LEGACY_SECRET_CHECK_INTERVAL_SECONDS,
  GEO_INGEST_LEGACY_SECRET_DEADLINE,
  GEO_INGEST_LEGACY_SECRET_EMAILED_KEY_PREFIX,
  GEO_INGEST_LEGACY_SECRET_EMAILED_TTL_SECONDS,
  GEO_INGEST_LEGACY_SECRET_RECIPIENT_ROLES,
  GEO_INGEST_LEGACY_SECRET_SEEN_KEY_PREFIX,
  GEO_INGEST_LEGACY_SECRET_SEEN_TTL_SECONDS,
} from "../constants/ingest";
import { getGeoIngestTokenGeneration } from "../geo/ingest";
import type { GeoIngestIdentity } from "../types/geo";
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

async function sendRotationEmails(organizationId: string): Promise<boolean> {
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
    geoLog.warn({
      event: "geo.ingest.legacy_secret_no_recipients",
      organizationId,
      organizationFound: Boolean(organization),
    });
    return true;
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
    logGeoFailure(
      "geo.ingest.legacy_secret_email_failed",
      "Token rotation email failed",
      new Error(`${firstError.name}: ${firstError.message}`),
      { organizationId, failed: errors.length, status: firstError.status }
    );
  }
  return errors.length === 0;
}

async function emailOrganization(organizationId: string): Promise<void> {
  const emailedKey = `${GEO_INGEST_LEGACY_SECRET_EMAILED_KEY_PREFIX}:${organizationId}`;
  if (
    !(await claim(emailedKey, GEO_INGEST_LEGACY_SECRET_EMAILED_TTL_SECONDS))
  ) {
    return;
  }
  let sent = false;
  try {
    sent = await sendRotationEmails(organizationId);
  } finally {
    if (!sent) {
      await geoIngestRedis.del(emailedKey);
    }
  }
}

/**
 * Emails owners and admins once when an active token still verifies against a
 * previous ingest secret, retrying failed sends within a minute, and logs it at
 * most hourly per token scope. Revoked tokens stay silent.
 */
export async function notifyGeoIngestLegacySecret({
  organizationId,
  projectId,
  generation,
}: GeoIngestIdentity): Promise<void> {
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
    const activeGeneration = await getGeoIngestTokenGeneration(
      organizationId,
      projectId
    );
    if (activeGeneration !== generation) {
      return;
    }
    if (
      await claim(
        `${GEO_INGEST_LEGACY_SECRET_SEEN_KEY_PREFIX}:${scope}`,
        GEO_INGEST_LEGACY_SECRET_SEEN_TTL_SECONDS
      )
    ) {
      geoLog.warn({
        event: "geo.ingest.legacy_secret",
        organizationId,
        projectId,
      });
    }
    await emailOrganization(organizationId);
  } catch (error) {
    logGeoFailure(
      "geo.ingest.legacy_secret_notify_failed",
      "Legacy ingest secret notification failed",
      error,
      { organizationId, projectId }
    );
  }
}
