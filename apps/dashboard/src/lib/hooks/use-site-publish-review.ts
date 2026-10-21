import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishDialogProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";
import { siteDraftValidationOptions } from "@/utils/site-draft-validation-options";
import { siteDraftVersion } from "@/utils/site-draft-version";
import { publishConflictPaths } from "@/utils/site-drafts";
import { sitePublishMessageKey } from "@/utils/site-publish-message";
import { siteValidationReady } from "@/utils/site-validation-ready";

export function useSitePublishReview(props: SitePublishDialogProps) {
  const { organizationId, siteId, branch, drafts, draftCount, open, unsaved } =
    props;
  const t = useTranslations("sites.publish");
  const [customMessage, setMessage] = useState<string | null>(null);
  const message =
    customMessage ?? (props.initialMessage || t(sitePublishMessageKey(drafts)));
  const client = useQueryClient();
  const version = siteDraftVersion(drafts);
  const validation = useQuery(
    siteDraftValidationOptions(
      { organizationId, siteId, branch },
      version,
      open && !unsaved
    )
  );
  const statusOptions = dashboardOrpc.sites.branches.status.queryOptions({
    input: { organizationId, siteId, branch },
    enabled: open,
    staleTime: 0,
  });
  const status = useQuery({
    ...statusOptions,
  });
  const feature = Boolean(
    props.branchControls?.branch &&
    props.branchControls.branch !== props.branchControls.productionBranch
  );
  const direct = !feature && status.data?.canPublishDirect === true;
  const ready =
    !unsaved &&
    siteValidationReady(validation) &&
    status.isSuccess &&
    !status.isPlaceholderData;
  const canPublish =
    direct && ready && message.trim().length > 0 && draftCount > 0;
  const publish = useMutation({
    mutationFn: () =>
      dashboardOrpc.sites.editor.publish.call({
        organizationId,
        siteId,
        branch,
        message: message.trim(),
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({
        queryKey: dashboardOrpc.sites.key(),
        refetchType: "all",
      });
      setMessage(null);
      props.onOpenChange(false);
      props.onPublished();
      toast.success(result.deployPending ? t("deployPending") : t("committed"));
    },
    onError: (error) => {
      const paths = publishConflictPaths(error);
      if (paths && paths.length > 0) {
        props.onConflict(paths);
        return;
      }
      toast.error(toErrorMessage(error, t("failed")));
    },
  });
  return {
    message,
    setMessage,
    validation,
    status,
    feature,
    direct,
    ready,
    canPublish,
    publish,
    target:
      props.branchControls?.productionBranch ??
      status.data?.branch ??
      branch ??
      "",
  };
}
