import { artifactPath } from "@notra/ai/utils/artifact-path";
import { db } from "@notra/db/drizzle";
import { artifacts, autopilotBriefs, members } from "@notra/db/schema";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne } from "drizzle-orm";

import { AUTOPILOT_BRIEF_ID_PATTERN } from "@/constants/autopilot-brief";
import { getSession } from "@/lib/auth/actions";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import type { UiRouteInput } from "@/types/ui-route";
import { autopilotBriefPath } from "@/utils/autopilot-brief";

/**
 * Every brief reads as its artifact, so /brief/:id only redirects there. A
 * brief without one (older briefs, or a delivery whose save failed) gets it
 * saved on this first visit. Only members of its workspace get through:
 * its items can be merged. Anyone else gets a plain 404.
 */
export const loadAutopilotBriefPage = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params } }) => {
    const briefId = params.id ?? "";
    if (!AUTOPILOT_BRIEF_ID_PATTERN.test(briefId)) {
      throw notFound();
    }
    const session = await getSession();
    if (!session?.user) {
      throw redirect({
        href: `/login?returnTo=${encodeURIComponent(autopilotBriefPath(briefId))}`,
      });
    }
    const [row] = await db
      .select({
        organizationId: autopilotBriefs.organizationId,
        content: autopilotBriefs.content,
        createdAt: autopilotBriefs.createdAt,
        storedArtifactId: autopilotBriefs.artifactId,
        artifactId: artifacts.id,
      })
      .from(autopilotBriefs)
      // An artifact that was deleted or has no repository doesn't count.
      .leftJoin(
        artifacts,
        and(
          eq(artifacts.id, autopilotBriefs.artifactId),
          ne(artifacts.headSha, "")
        )
      )
      .innerJoin(
        members,
        and(
          eq(members.organizationId, autopilotBriefs.organizationId),
          eq(members.userId, session.user.id)
        )
      )
      .where(eq(autopilotBriefs.id, briefId))
      .limit(1);
    if (
      !(row && (await isAutopilotEnabledForOrganization(row.organizationId)))
    ) {
      throw notFound();
    }
    if (row.artifactId) {
      throw redirect({ href: artifactPath(row.artifactId) });
    }
    const { ensureBriefArtifact } = await import("@/lib/autopilot/brief-page");
    const saved = await ensureBriefArtifact(
      row.organizationId,
      {
        id: briefId,
        content: row.content,
        createdAt: row.createdAt,
        artifactId: null,
      },
      row.storedArtifactId ? { replaces: row.storedArtifactId } : {}
    );
    if (!saved.artifactId) {
      throw new Error("The brief could not be opened. Try again in a moment.");
    }
    throw redirect({ href: artifactPath(saved.artifactId) });
  });
