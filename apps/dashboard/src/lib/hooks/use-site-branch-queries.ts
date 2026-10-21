import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteBranchControlsProps } from "@/types/site-branches";
import {
  serverSiteBranchVisibility,
  siteBranchVisibility,
  subscribeSiteBranchVisibility,
} from "@/utils/site-branch-visibility";
import { siteValidationReady } from "@/utils/site-validation-ready";

/** Branch status, validation and the branch list behind the editor's branch controls. */
export function useSiteBranchQueries({
  organizationId,
  siteId,
  branch,
  productionBranch,
  draftVersion,
  unsaved,
}: SiteBranchControlsProps) {
  const scope = { organizationId, siteId, branch };
  const statusOptions = dashboardOrpc.sites.branches.status.queryOptions({
    input: scope,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
  const status = useQuery({
    ...statusOptions,
    queryKey: [...statusOptions.queryKey, draftVersion],
  });
  const validationOptions = dashboardOrpc.sites.editor.validate.queryOptions({
    input: scope,
    enabled: !unsaved,
    staleTime: 0,
  });
  const validation = useQuery({
    ...validationOptions,
    queryKey: [...validationOptions.queryKey, draftVersion],
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const branches = useQuery(
    dashboardOrpc.sites.branches.list.queryOptions({
      input: { organizationId, siteId, search: debouncedSearch },
      enabled: menuOpen,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
    })
  );
  const showBranches = useSyncExternalStore(
    subscribeSiteBranchVisibility,
    siteBranchVisibility,
    serverSiteBranchVisibility
  );
  const feature = Boolean(branch && branch !== productionBranch);
  return {
    status,
    branches,
    search,
    setSearch,
    menuOpen,
    setMenuOpen,
    showBranches,
    feature,
    current: branch ?? productionBranch,
    invalid:
      unsaved ||
      !siteValidationReady(validation) ||
      !status.isSuccess ||
      status.isPlaceholderData,
    canShow:
      feature ||
      showBranches ||
      Boolean(status.data?.hasFeatureBranches) ||
      !status.data?.canPublishDirect,
  };
}
