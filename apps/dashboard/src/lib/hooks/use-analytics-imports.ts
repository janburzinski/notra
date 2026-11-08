"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ANALYTICS_IMPORT_POLL_MS } from "@/constants/analytics-imports";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AnalyticsImportOverlapMode } from "@/types/analytics-imports";
import { isImportActive } from "@/utils/analytics-imports";

export function useAnalyticsImports(
  organizationId: string,
  projectId: string | null,
  enabled = true
) {
  return useQuery(
    dashboardOrpc.analyticsImports.list.queryOptions({
      input: { organizationId, projectId },
      enabled: enabled && organizationId.length > 0,
      // A deleting import is watched too, until it leaves the list.
      refetchInterval: (query) =>
        query.state.data?.imports.some(
          (item) => isImportActive(item.status) || item.status === "deleting"
        )
          ? ANALYTICS_IMPORT_POLL_MS
          : false,
    })
  );
}

export function useAnalyticsImportSources(
  organizationId: string,
  connectionId: string | null
) {
  return useQuery(
    dashboardOrpc.analyticsImports.sources.queryOptions({
      input: { organizationId, connectionId: connectionId ?? "" },
      enabled: organizationId.length > 0 && Boolean(connectionId),
      retry: false,
    })
  );
}

export function useAnalyticsImportMutations(organizationId: string) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.analyticsImports.list.key(),
      }),
      queryClient.invalidateQueries({ queryKey: dashboardOrpc.geo.key() }),
    ]);
  };
  const connect = useMutation({
    mutationFn: (
      input: Omit<
        Parameters<typeof dashboardOrpc.analyticsImports.connect.call>[0],
        "organizationId"
      >
    ) =>
      dashboardOrpc.analyticsImports.connect.call({ organizationId, ...input }),
    onSettled: invalidate,
  });
  const preview = useMutation({
    mutationFn: (
      input: Omit<
        Parameters<typeof dashboardOrpc.analyticsImports.preview.call>[0],
        "organizationId"
      >
    ) =>
      dashboardOrpc.analyticsImports.preview.call({ organizationId, ...input }),
  });
  const create = useMutation({
    mutationFn: (
      input: Omit<
        Parameters<typeof dashboardOrpc.analyticsImports.create.call>[0],
        "organizationId"
      >
    ) =>
      dashboardOrpc.analyticsImports.create.call({ organizationId, ...input }),
    onSettled: invalidate,
  });
  const csv = useMutation({
    mutationFn: async (input: {
      projectId: string;
      host: string;
      file: File;
      previewOnly: boolean;
      overlap?: AnalyticsImportOverlapMode;
      uploadKey?: string;
    }) => {
      let uploadKey = input.uploadKey;
      if (!uploadKey) {
        const { target } =
          await dashboardOrpc.analyticsImports.uploadTarget.call({
            organizationId,
            fileSize: input.file.size,
          });
        if (target.mode === "storage") {
          const response = await fetch(target.url, {
            method: "PUT",
            headers: target.headers,
            body: input.file,
          });
          if (!response.ok) {
            throw new Error("Upload failed");
          }
          uploadKey = target.key;
        }
      }
      const result = await dashboardOrpc.analyticsImports.csv.call({
        organizationId,
        projectId: input.projectId,
        host: input.host,
        previewOnly: input.previewOnly,
        overlap: input.overlap,
        ...(uploadKey ? { uploadKey } : { file: input.file }),
      });
      return { ...result, uploadKey };
    },
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (importId: string) =>
      dashboardOrpc.analyticsImports.delete.call({ organizationId, importId }),
    onSettled: invalidate,
  });
  const disconnect = useMutation({
    mutationFn: (input: { connectionId: string; deleteImports: boolean }) =>
      dashboardOrpc.analyticsImports.disconnect.call({
        organizationId,
        ...input,
      }),
    onSettled: invalidate,
  });
  return { connect, preview, create, csv, remove, disconnect };
}
