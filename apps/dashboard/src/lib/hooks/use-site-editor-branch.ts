import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useSiteBranchAutosave } from "@/lib/hooks/use-site-branch-autosave";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { UseSiteEditorBranchParams } from "@/types/hooks/site-editor-branch";
import { isInvalidSiteBranchError } from "@/utils/invalid-site-branch";

export function useSiteEditorBranch({
  organizationId,
  siteId,
  branch,
  productionBranch,
  filesError,
  draftVersion,
  draftCount,
  saves,
  onFlushed,
  onConflict,
  onSwitch,
}: UseSiteEditorBranchParams) {
  const t = useTranslations("sites.editorPage");
  const recovering = useRef(false);
  const branchStatus = useQuery(
    dashboardOrpc.sites.branches.status.queryOptions({
      input: { organizationId, siteId, branch },
      staleTime: 30_000,
    })
  );
  useEffect(() => {
    if (
      branch &&
      !recovering.current &&
      (isInvalidSiteBranchError(filesError) ||
        isInvalidSiteBranchError(branchStatus.error))
    ) {
      recovering.current = true;
      void onSwitch(null).then(() =>
        toast.info(t("branchNotFound", { branch: productionBranch }))
      );
    }
  }, [branch, filesError, branchStatus.error, onSwitch, productionBranch, t]);
  const feature = Boolean(
    branch && branch !== productionBranch && branchStatus.data?.canEdit === true
  );
  const autoCommit = useSiteBranchAutosave(
    { organizationId, siteId, branch },
    feature,
    draftVersion,
    draftCount,
    saves.unsaved,
    saves.flush,
    onFlushed,
    onConflict
  );
  return {
    branchStatus,
    flush: async () => {
      if (feature) {
        await autoCommit.mutateAsync();
      } else {
        await saves.flush();
      }
    },
    switchBranch: async (next: string) => {
      autoCommit.suppressLeave();
      await onSwitch(next === productionBranch ? null : next);
    },
  };
}
