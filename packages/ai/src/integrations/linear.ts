import { db } from "@notra/db/drizzle";
import { linearIntegrations } from "@notra/db/schema";
import { decryptToken } from "@notra/db/utils/integration-encryption";
import { and, eq } from "drizzle-orm";

import type { LinearToolContext } from "../types/tools";
import { resolveLinearAccessToken } from "./linear-oauth";

const createdByUserRelation = {
  createdByUser: {
    columns: { id: true, name: true, email: true, image: true },
  },
} as const;

export async function getLinearIntegrationById(integrationId: string) {
  const integration = await db.query.linearIntegrations.findFirst({
    where: eq(linearIntegrations.id, integrationId),
    with: createdByUserRelation,
  });

  return integration ?? null;
}

export async function getLinearIntegrationsByOrganization(
  organizationId: string
) {
  return db.query.linearIntegrations.findMany({
    where: eq(linearIntegrations.organizationId, organizationId),
    with: createdByUserRelation,
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
}

export async function updateLinearIntegration(
  integrationId: string,
  updates: {
    displayName?: string;
    enabled?: boolean;
    linearTeamId?: string | null;
    linearTeamName?: string | null;
  }
) {
  const [updated] = await db
    .update(linearIntegrations)
    .set(updates)
    .where(eq(linearIntegrations.id, integrationId))
    .returning();

  return updated;
}

export async function deleteLinearIntegration(integrationId: string) {
  await db
    .delete(linearIntegrations)
    .where(eq(linearIntegrations.id, integrationId));
}

export async function getDecryptedLinearWebhookSecret(
  integrationId: string
): Promise<string | undefined> {
  const [integration] = await db
    .select({
      encryptedWebhookSecret: linearIntegrations.encryptedWebhookSecret,
    })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.id, integrationId))
    .limit(1);

  if (!integration?.encryptedWebhookSecret) {
    return undefined;
  }

  return decryptToken(integration.encryptedWebhookSecret);
}

export async function getLinearToolContextByIntegrationId(
  integrationId: string,
  options?: { organizationId?: string }
): Promise<LinearToolContext> {
  const [integration] = await db
    .select({
      id: linearIntegrations.id,
      organizationId: linearIntegrations.organizationId,
      encryptedAccessToken: linearIntegrations.encryptedAccessToken,
      accessTokenExpiresAt: linearIntegrations.accessTokenExpiresAt,
      linearTeamId: linearIntegrations.linearTeamId,
      enabled: linearIntegrations.enabled,
    })
    .from(linearIntegrations)
    .where(
      and(
        eq(linearIntegrations.id, integrationId),
        options?.organizationId
          ? eq(linearIntegrations.organizationId, options.organizationId)
          : undefined
      )
    )
    .limit(1);

  if (!integration) {
    throw new Error(
      `Linear integration access denied. Unknown integrationId ${integrationId}.`
    );
  }

  if (!integration.enabled) {
    throw new Error(
      `Linear integration access denied for integrationId ${integrationId}. Integration is disabled.`
    );
  }

  return {
    integrationId: integration.id,
    organizationId: integration.organizationId,
    accessToken: await resolveLinearAccessToken(integration),
    linearTeamId: integration.linearTeamId,
  };
}
