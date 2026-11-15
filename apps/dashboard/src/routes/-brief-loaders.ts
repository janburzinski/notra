import { artifactPath } from "@notra/ai/utils/artifact-path";
import { db } from "@notra/db/drizzle";
import {
  artifacts,
  autopilotBriefs,
  members,
  organizations,
} from "@notra/db/schema";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";

import { AUTOPILOT_BRIEF_ID_PATTERN } from "@/constants/autopilot-brief";
import { getSession } from "@/lib/auth/actions";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import type { UiRouteInput } from "@/types/ui-route";
import { autopilotBriefPath } from "@/utils/autopilot-brief";

/**
 * A brief opens outside the dashboard, but only for members of its
 * workspace: it can merge pull requests. Anyone else gets a plain 404.
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
        organizationId: organizations.id,
        organizationSlug: organizations.slug,
        organizationName: organizations.name,
        artifactId: artifacts.id,
      })
      .from(autopilotBriefs)
      .innerJoin(
        organizations,
        eq(organizations.id, autopilotBriefs.organizationId)
      )
      // Briefs written since they became artifacts open as one, unless it
      // was deleted; older briefs keep their own page.
      .leftJoin(
        artifacts,
        and(
          eq(artifacts.id, autopilotBriefs.artifactId),
          isNull(artifacts.deletedAt)
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
    const { artifactId: _artifactId, ...organization } = row;
    return { briefId, ...organization };
  });
