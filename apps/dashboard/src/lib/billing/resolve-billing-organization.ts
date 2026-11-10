import { db } from "@notra/db/drizzle";
import { members, organizations } from "@notra/db/schema";
import { organizationSlugParamSchema } from "@notra/schemas/dashboard/auth/organization";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { AUTUMN_ORGANIZATION_HEADER } from "@/constants/billing";
import { getAuthSession } from "@/lib/auth/server";
import type { AuthIdentityData } from "@/types/auth/session";

const findMemberOrganizationIdBySlug = Effect.fn(
  "billing.resolveOrganization.bySlug"
)(function* (slug: string, userId: string) {
  const organization = yield* Effect.tryPromise(() =>
    db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
      columns: { id: true },
      with: {
        members: {
          where: eq(members.userId, userId),
          columns: { id: true },
        },
      },
    })
  );

  if (!organization || organization.members.length === 0) {
    return null;
  }

  return organization.id;
});

export async function resolveBillingOrganizationId(
  request: Request,
  identity: AuthIdentityData
): Promise<string | null> {
  const requestedSlugHeader = request.headers.get(AUTUMN_ORGANIZATION_HEADER);

  if (requestedSlugHeader === null) {
    // Only requests without the header need the cookie-based active org.
    const session = await getAuthSession();
    return session?.session.activeOrganizationId ?? null;
  }

  const requestedSlug =
    organizationSlugParamSchema.safeParse(requestedSlugHeader);

  if (!requestedSlug.success) {
    return null;
  }

  return await Effect.runPromise(
    findMemberOrganizationIdBySlug(requestedSlug.data, identity.user.id).pipe(
      Effect.catch(() => Effect.succeed(null))
    )
  );
}
