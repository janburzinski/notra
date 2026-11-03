import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";

export function useImportableRepositories(organizationId: string) {
  return useQuery(
    dashboardOrpc.sites.importableRepositories.queryOptions({
      input: { organizationId },
      enabled: organizationId.length > 0,
    })
  );
}

function refreshMutationKey(organizationId: string) {
  return ["sites", "refreshImportableRepositories", organizationId];
}

/** Reloads the list straight from GitHub, e.g. after the user changed app access there. */
export function useRefreshImportableRepositories(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: refreshMutationKey(organizationId),
    mutationFn: () =>
      dashboardOrpc.sites.importableRepositories.call({
        organizationId,
        refresh: true,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        dashboardOrpc.sites.importableRepositories.queryKey({
          input: { organizationId },
        }),
        data
      );
    },
  });
}

export function useIsRefreshingImportableRepositories(organizationId: string) {
  return useIsMutating({ mutationKey: refreshMutationKey(organizationId) }) > 0;
}

export function useConnectSiteRepository(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (githubRepositoryId: string) =>
      dashboardOrpc.sites.connectRepository.call({
        organizationId,
        githubRepositoryId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.sites.importableRepositories.key(),
      });
    },
  });
}
