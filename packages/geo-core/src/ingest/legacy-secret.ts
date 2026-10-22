import { geoLog } from "@notra/ai/evlog";
import { db } from "@notra/db/drizzle";
import { members, organizations } from "@notra/db/schema";
import { GeoTokenRotationEmail } from "@notra/email/emails/geo-token-rotation";
import { sendBrewEmail } from "@notra/email/utils/brew";
import { and, eq, inArray } from "drizzle-orm";

import {
  GEO_INGEST_LEGACY_SECRET_DEADLINE,
  GEO_INGEST_LEGACY_SECRET_EMAILED_KEY_PREFIX,
  GEO_INGEST_LEGACY_SECRET_EMAILED_TTL_SECONDS,
  GEO_INGEST_LEGACY_SECRET_RECIPIENT_ROLES,
  GEO_INGEST_LEGACY_SECRET_SEEN_KEY_PREFIX,
  GEO_INGEST_LEGACY_SECRET_SEEN_TTL_SECONDS,
} from "../constants/ingest";
import { logGeoFailure } from "../utils/geo-log";
import { geoIngestRedis } from "./ratelimit";

async function claim(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await geoIngestRedis.set(key, 1, {
    nx: true,
    ex: ttlSeconds,
  });
  return result === "OK";
}

async function emailOrganization(organizationId: string): Promise<void> {
  const emailedKey = `${GEO_INGEST_LEGACY_SECRET_EMAILED_KEY_PREFIX}:${organizationId}`;
  if (
    !(await claim(emailedKey, GEO_INGEST_LEGACY_SECRET_EMAILED_TTL_SECONDS))
  ) {
    return;
  }

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
  if (!organization) {
    return;
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
  const failed = results.filter((result) => result.error);
  if (failed.length > 0) {
    await geoIngestRedis.del(emailedKey);
    logGeoFailure(
      "geo.ingest.legacy_secret_email_failed",
      "Token rotation email failed",
      failed[0]?.error,
      { organizationId, failed: failed.length }
    );
  }
}

/**
 * Logs at most hourly per organization that its token still verifies against
 * a previous ingest secret, and emails owners and admins once to rotate it.
 */
export async function notifyGeoIngestLegacySecret(
  organizationId: string,
  projectId: string | null
): Promise<void> {
  try {
    const seenKey = `${GEO_INGEST_LEGACY_SECRET_SEEN_KEY_PREFIX}:${organizationId}`;
    if (!(await claim(seenKey, GEO_INGEST_LEGACY_SECRET_SEEN_TTL_SECONDS))) {
      return;
    }
    geoLog.warn({
      event: "geo.ingest.legacy_secret",
      organizationId,
      projectId,
    });
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
