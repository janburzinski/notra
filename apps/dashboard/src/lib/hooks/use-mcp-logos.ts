"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getMcpIconUrls } from "@/lib/integrations/mcp";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { McpIconUrls } from "@/types/integrations/mcp";

/** Logos of the organization's MCP connections, by connection id, for chat tool rows. */
export function useMcpLogosByConnectionId(
  organizationId: string
): ReadonlyMap<string, McpIconUrls> {
  const enabled = Boolean(organizationId);
  const { data: customMcpData } = useQuery(
    dashboardOrpc.integrations.mcp.list.queryOptions({
      input: { organizationId },
      enabled,
    })
  );
  const { data: mcpStoreData } = useQuery(
    dashboardOrpc.integrations.mcp.storeList.queryOptions({
      input: { organizationId },
      enabled,
    })
  );
  return useMemo(
    () =>
      new Map([
        ...(customMcpData?.servers ?? []).map(
          (server) =>
            [
              server.id,
              getMcpIconUrls({
                darkUrl: server.logoDarkUrl,
                lightUrl: server.logoLightUrl,
              }),
            ] as const
        ),
        ...(mcpStoreData?.integrations ?? []).flatMap((integration) =>
          integration.connection
            ? [
                [
                  integration.connection.id,
                  getMcpIconUrls({
                    darkUrl: integration.logoDarkUrl,
                    lightUrl: integration.logoLightUrl,
                  }),
                ] as const,
              ]
            : []
        ),
      ]),
    [customMcpData?.servers, mcpStoreData?.integrations]
  );
}
