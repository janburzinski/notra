import {
  ArtifactConflictError,
  ArtifactNotFoundError,
  readArtifact,
  restoreArtifactVersion,
} from "@notra/ai/chat/artifacts";
import {
  deleteArtifactInputSchema,
  getArtifactInputSchema,
  restoreArtifactInputSchema,
  setArtifactSharedInputSchema,
} from "@notra/schemas/dashboard/artifacts";

import { deleteArtifact, setArtifactShared } from "@/lib/artifacts/manage";
import { loadArtifactView } from "@/lib/artifacts/view";
import { isAutopilotEnabledForOrganization } from "@/lib/billing/autopilot-entitlement";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import { assertNotDemo, conflict, notFound } from "@/lib/orpc/utils/errors";

const NOT_FOUND = "Artifact not found";

export const artifactsRouter = {
  get: authorizedProcedure
    .input(getArtifactInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input, context }) => {
      const view = await loadArtifactView({
        organizationId: input.organizationId,
        artifactId: input.artifactId,
        version: input.version,
        role: context.auth.membership.role,
      });
      if (!view) {
        throw notFound(NOT_FOUND);
      }
      return view;
    }),

  restore: authorizedProcedure
    .input(restoreArtifactInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input, context }) => {
      assertNotDemo();
      try {
        const saved = await restoreArtifactVersion({
          organizationId: input.organizationId,
          artifactId: input.artifactId,
          version: input.version,
          userId: context.user.id,
        });
        return { version: saved.version };
      } catch (error) {
        if (error instanceof ArtifactNotFoundError) {
          throw notFound(NOT_FOUND);
        }
        if (error instanceof ArtifactConflictError) {
          throw conflict(error.message);
        }
        throw error;
      }
    }),

  setShared: authorizedProcedure
    .input(setArtifactSharedInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      assertNotDemo();
      // Unsharing always works; publishing an Autopilot brief needs the plan.
      if (input.shared) {
        const read = await readArtifact(input.organizationId, input.artifactId);
        if (
          read?.artifact.source === "autopilot" &&
          !(await isAutopilotEnabledForOrganization(input.organizationId))
        ) {
          throw notFound(NOT_FOUND);
        }
      }
      const result = await setArtifactShared(
        input.organizationId,
        input.artifactId,
        input.shared
      );
      if (!result) {
        throw notFound(NOT_FOUND);
      }
      return result;
    }),

  delete: authorizedProcedure
    .input(deleteArtifactInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ input }) => {
      assertNotDemo();
      if (!(await deleteArtifact(input.organizationId, input.artifactId))) {
        throw notFound(NOT_FOUND);
      }
      return { success: true as const };
    }),
};
