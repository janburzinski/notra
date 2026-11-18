import {
  ARTIFACT_ID_LENGTH,
  ARTIFACT_SHARE_ID_LENGTH,
} from "@notra/ai/constants/artifacts";
import { artifactPath } from "@notra/ai/utils/artifact-path";
import { db } from "@notra/db/drizzle";
import { artifacts, members, organizations } from "@notra/db/schema";
import { isDemoMode } from "@notra/utils/demo-mode";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, ne } from "drizzle-orm";

import { getSession } from "@/lib/auth/actions";
import { isAutopilotEnabledForOrganization } from "@/lib/billing/autopilot-entitlement";
import type { UiRouteInput } from "@/types/ui-route";

const ARTIFACT_ID_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${ARTIFACT_ID_LENGTH}}$`
);
const SHARE_ID_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${ARTIFACT_SHARE_ID_LENGTH}}$`
);

/**
 * An artifact's own page is for members of its workspace only, like the
 * daily brief: its Autopilot items can be merged. Anyone else gets a 404.
 */
export const loadArtifactPage = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params } }) => {
    const artifactId = params.id ?? "";
    if (!ARTIFACT_ID_PATTERN.test(artifactId)) {
      throw notFound();
    }
    const session = await getSession();
    if (!session?.user) {
      throw redirect({
        href: `/login?returnTo=${encodeURIComponent(artifactPath(artifactId))}`,
      });
    }
    const [row] = await db
      .select({
        title: artifacts.title,
        organizationId: organizations.id,
        organizationSlug: organizations.slug,
        organizationName: organizations.name,
        source: artifacts.source,
      })
      .from(artifacts)
      .innerJoin(organizations, eq(organizations.id, artifacts.organizationId))
      .innerJoin(
        members,
        and(
          eq(members.organizationId, artifacts.organizationId),
          eq(members.userId, session.user.id)
        )
      )
      // Rows the previous app inserted mid-deploy have no repository.
      .where(and(eq(artifacts.id, artifactId), ne(artifacts.headSha, "")))
      .limit(1);
    if (!row) {
      throw notFound();
    }
    const { source, ...page } = row;
    // An Autopilot brief goes with the plan, like its /brief link.
    if (
      source === "autopilot" &&
      !(await isAutopilotEnabledForOrganization(page.organizationId))
    ) {
      throw notFound();
    }
    return { artifactId, ...page };
  });

export const loadSharedArtifact = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params } }) => {
    const shareId = params.id ?? "";
    if (isDemoMode() || !SHARE_ID_PATTERN.test(shareId)) {
      throw notFound();
    }
    const { loadSharedArtifactView } = await import("@/lib/artifacts/view");
    const artifact = await loadSharedArtifactView(shareId);
    if (!artifact) {
      throw notFound();
    }
    return artifact;
  });
