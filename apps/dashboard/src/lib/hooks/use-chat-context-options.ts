"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ChatContextOption,
  EnabledLinear,
  EnabledRepo,
} from "@/types/components/chat-input";
import { buildContentChatContextOptions } from "@/utils/chat-input";

/**
 * What a composer can attach as context: enabled GitHub repos and Linear
 * teams, and with `includeMcp` the connected MCP servers too.
 */
export function useChatContextOptions(
  organizationId: string | undefined,
  { includeMcp = false }: { includeMcp?: boolean } = {}
): ChatContextOption[] {
  const t = useTranslations("chat.input");
  const enabled = Boolean(organizationId);
  const input = { organizationId: organizationId ?? "" };
  const { data: integrationsData } = useQuery(
    dashboardOrpc.integrations.list.queryOptions({ input, enabled })
  );
  const { data: customMcpData } = useQuery(
    dashboardOrpc.integrations.mcp.list.queryOptions({
      input,
      enabled: enabled && includeMcp,
    })
  );
  const { data: mcpStoreData } = useQuery(
    dashboardOrpc.integrations.mcp.storeList.queryOptions({
      input,
      enabled: enabled && includeMcp,
    })
  );

  return useMemo(() => {
    const enabledRepos: EnabledRepo[] = [];
    const enabledLinear: EnabledLinear[] = [];
    for (const integration of integrationsData?.integrations ?? []) {
      for (const repo of integration.repositories) {
        if (integration.enabled && repo.enabled) {
          enabledRepos.push({ ...repo, integrationId: integration.id });
        }
      }
      if (integration.type === "linear" && integration.enabled) {
        enabledLinear.push({
          id: integration.id,
          displayName: integration.displayName,
          integrationId: integration.id,
          teamName:
            "linearTeamName" in integration
              ? (integration.linearTeamName as string | null)
              : null,
        });
      }
    }
    const options = buildContentChatContextOptions({
      enabledLinear,
      enabledRepos,
      labels: {
        githubRepository: t("options.githubRepository"),
        linearTeam: t("options.linearTeam"),
      },
    });
    if (!includeMcp) {
      return options;
    }

    for (const server of customMcpData?.servers ?? []) {
      if (!server.enabled) {
        continue;
      }
      const toolLabel = `${server.indexedToolCount} ${server.indexedToolCount === 1 ? "tool" : "tools"}`;
      options.push({
        id: `mcp-${server.id}`,
        kind: "mcp",
        label: server.name,
        description: t("options.customMcp", {
          count: server.indexedToolCount,
        }),
        searchText: `${server.name} ${server.description ?? ""} custom MCP ${toolLabel}`,
        contextItem: {
          type: "mcp-server",
          integrationId: server.id,
          name: server.name,
        },
        logoLightUrl: server.logoLightUrl,
        logoDarkUrl: server.logoDarkUrl,
      });
    }
    for (const integration of mcpStoreData?.integrations ?? []) {
      const connection = integration.connection;
      if (!(integration.connected && connection?.enabled)) {
        continue;
      }
      const toolLabel = `${connection.indexedToolCount} ${connection.indexedToolCount === 1 ? "tool" : "tools"}`;
      options.push({
        id: `mcp-${connection.id}`,
        kind: "mcp",
        label: integration.name,
        description: t("options.marketplaceMcp", {
          count: connection.indexedToolCount,
        }),
        searchText: `${integration.name} ${integration.description ?? ""} ${integration.author ?? ""} marketplace MCP ${toolLabel}`,
        contextItem: {
          type: "mcp-server",
          integrationId: connection.id,
          name: integration.name,
        },
        logoLightUrl: integration.logoLightUrl,
        logoDarkUrl: integration.logoDarkUrl,
      });
    }
    return options;
  }, [
    customMcpData?.servers,
    includeMcp,
    integrationsData?.integrations,
    mcpStoreData?.integrations,
    t,
  ]);
}
