import { getLinearToolContextByIntegrationId } from "@notra/ai/integrations/linear";
import { createLinearClient } from "@notra/ai/utils/linear";
import { defineTool } from "eve/tools";

import {
  LINEAR_CYCLE_LOOKBACK_MS,
  LINEAR_RECENT_CYCLES_LIMIT,
} from "../constants/linear";
import { getLinearCyclesInputSchema } from "../schemas/assistant-tools";
import { runLinearTool } from "../utils/linear";
import { requireOrganizationId } from "../utils/organization";

export function createGetLinearCyclesTool() {
  return defineTool({
    description:
      "Get recent Linear cycles for a team (name, progress, timeline). Returns the most recent cycles including the active one. Requires a connected Linear integration.",
    inputSchema: getLinearCyclesInputSchema,
    execute({ integrationId }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      return runLinearTool(
        "get_linear_cycles",
        { organizationId, integrationId },
        async () => {
          const resolved = await getLinearToolContextByIntegrationId(
            integrationId,
            { organizationId }
          );
          const client = createLinearClient(resolved.accessToken);

          if (!resolved.linearTeamId) {
            return {
              cycles: [],
              note: "No team scoped for this integration. Cycles are team-specific in Linear.",
            };
          }

          // Linear can only order by createdAt/updatedAt, so load every active
          // and recent cycle and sort by start date here.
          const team = await client.team(resolved.linearTeamId);
          const cycles = await team.cycles({
            first: 50,
            filter: {
              isFuture: { eq: false },
              endsAt: {
                gte: new Date(Date.now() - LINEAR_CYCLE_LOOKBACK_MS),
              },
            },
          });
          while (cycles.pageInfo.hasNextPage) {
            await cycles.fetchNext();
          }

          const results = cycles.nodes
            .toSorted((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
            .slice(0, LINEAR_RECENT_CYCLES_LIMIT)
            .map((cycle) => ({
              id: cycle.id,
              name: cycle.name ?? null,
              number: cycle.number,
              startsAt: cycle.startsAt.toISOString(),
              endsAt: cycle.endsAt.toISOString(),
              progress: cycle.progress,
              completedAt: cycle.completedAt?.toISOString() ?? null,
            }));

          return { cycles: results };
        }
      );
    },
  });
}
