import { db } from "@notra/db/drizzle";
import { members } from "@notra/db/schema";
import { withAdvisorySessionLocks } from "@notra/db/utils/advisory-session-lock";
import { SITE_PREVIEW_AUTH_PATH } from "@notra/sites-core/constants/sites";
import { previewIssuerLockKey } from "@notra/sites-core/utils/preview-issuer-lock";
import { safePreviewNextPath } from "@notra/sites-core/utils/preview-path";
import { getSite } from "@notra/sites-server/deployments";
import { previewAccessUrl } from "@notra/sites-server/preview-access";
import { sitePreviewOrigin } from "@notra/sites-server/utils/urls";
import { and, eq } from "drizzle-orm";

import { SITE_PREVIEW_KEY_PATTERN } from "@/constants/sites";
import {
  assertAuthenticated,
  assertOrganizationAccess,
} from "@/lib/auth/organization";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("site") ?? "";
  const previewKey = searchParams.get("preview") ?? "";
  const next = safePreviewNextPath(searchParams.get("next"));
  if (
    !(siteId.startsWith("site_") && SITE_PREVIEW_KEY_PATTERN.test(previewKey))
  ) {
    return new Response("Invalid preview link", { status: 400 });
  }
  const site = await getSite(siteId);
  if (!site) {
    return new Response("Preview not found", { status: 404 });
  }
  const denied = () => {
    const denied = new URL(
      SITE_PREVIEW_AUTH_PATH,
      sitePreviewOrigin(site.slug, previewKey)
    );
    denied.searchParams.set("error", "forbidden");
    denied.searchParams.set("next", next);
    return Response.redirect(denied, 302);
  };
  let userId: string;
  try {
    userId = (await assertAuthenticated({ headers: request.headers })).user.id;
  } catch {
    return denied();
  }
  return await withAdvisorySessionLocks(
    [previewIssuerLockKey(userId)],
    async () => {
      try {
        const currentMembership = await db.query.members.findFirst({
          columns: { id: true },
          where: and(
            eq(members.userId, userId),
            eq(members.organizationId, site.organizationId)
          ),
        });
        if (!currentMembership) {
          return denied();
        }
        await assertOrganizationAccess({
          headers: request.headers,
          organizationId: site.organizationId,
        });
      } catch {
        return denied();
      }
      const { url } = await previewAccessUrl({
        site,
        previewKey,
        next,
        kind: "member",
        userId,
      });
      return Response.redirect(url, 302);
    }
  );
}
