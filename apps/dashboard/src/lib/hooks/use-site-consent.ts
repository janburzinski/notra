import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteIntegrationSaveResult } from "@/types/site-integrations";
import type { SiteScope } from "@/types/sites";

function useInthConsentStatus(scope: SiteScope) {
  return useQuery(
    dashboardOrpc.sites.integrations.inth.status.queryOptions({
      input: { organizationId: scope.organizationId, siteId: scope.siteId },
      enabled: scope.organizationId.length > 0,
    })
  );
}

function useInthProjects(scope: SiteScope, enabled: boolean) {
  return useQuery(
    dashboardOrpc.sites.integrations.inth.projects.queryOptions({
      input: { organizationId: scope.organizationId, siteId: scope.siteId },
      enabled,
    })
  );
}

function useConnectInthProject(scope: SiteScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      dashboardOrpc.sites.integrations.inth.connect.call({
        organizationId: scope.organizationId,
        siteId: scope.siteId,
        projectId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.sites.key(),
      });
    },
  });
}

function useDisconnectInth(scope: SiteScope) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      dashboardOrpc.sites.integrations.inth.disconnect.call({
        organizationId: scope.organizationId,
        siteId: scope.siteId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.sites.key(),
      });
    },
  });
}

export function useInthConsent(scope: SiteScope) {
  const t = useTranslations("sites.integrationsPage.consent");
  const status = useInthConsentStatus(scope);
  const connected = Boolean(
    status.data?.connected && !status.data.reauthRequired
  );
  const projects = useInthProjects(scope, connected);
  const connect = useConnectInthProject(scope);
  const disconnect = useDisconnectInth(scope);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<SiteIntegrationSaveResult | null>(null);
  const selectedId =
    picked ?? status.data?.project?.id ?? projects.data?.[0]?.id ?? null;
  const selected = projects.data?.find((project) => project.id === selectedId);
  const applyProject = (projectId: string) => {
    setResult(null);
    connect.mutate(projectId, {
      onSuccess: ({ pullRequestUrl }) => {
        if (pullRequestUrl) {
          setResult({ action: "save", pullRequestUrl });
        } else {
          toast.success(t("originsAdded"));
        }
      },
    });
  };
  return {
    status,
    connected,
    projects,
    connect,
    disconnect,
    selectedId,
    selected,
    setPicked: (projectId: string | null) => {
      setPicked(projectId);
      setResult(null);
      connect.reset();
    },
    applyProject,
    result,
  };
}
