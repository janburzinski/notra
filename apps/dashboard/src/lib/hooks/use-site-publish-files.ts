import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useSite } from "@/components/sites/site-context";
import { useRouter } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishFilesState } from "@/types/hooks/sites";
import type { SiteScope } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import { siteHref } from "@/utils/site-links";

/** Loads the site's drafts so the publish dialog can list them. */
export function useSitePublishFiles(messages: {
  noDrafts: string;
  failed: string;
}) {
  const { organizationId, organizationSlug, siteId } = useSite();
  const router = useRouter();
  const queryClient = useQueryClient();
  const scope = useMemo(
    () => ({ organizationId, siteId }),
    [organizationId, siteId]
  );
  const activeScope = useRef<SiteScope | null>(null);
  const [state, setState] = useState<SitePublishFilesState | null>(null);
  useLayoutEffect(() => {
    activeScope.current = scope;
    return () => {
      activeScope.current = null;
    };
  }, [scope]);
  const current = () => activeScope.current === scope;
  const fail = (error: unknown) => {
    if (current()) {
      toast.error(toErrorMessage(error, messages.failed));
    }
    return null;
  };

  const open = async () => {
    if (!current()) {
      return false;
    }
    setState({ scope, files: null, preparing: true });
    const finish = () => {
      if (current()) {
        setState((value) => value && { ...value, preparing: false });
      }
      return false;
    };
    const status = await queryClient
      .fetchQuery({
        ...dashboardOrpc.sites.branches.status.queryOptions({
          input: { organizationId, siteId },
        }),
        staleTime: 0,
      })
      .catch(fail);
    if (!(status && current())) {
      return finish();
    }
    if (!status.canPublishDirect) {
      finish();
      router.push(siteHref(organizationSlug, siteId, "editor"));
      return false;
    }
    const loaded = await queryClient
      .fetchQuery({
        ...dashboardOrpc.sites.editor.files.queryOptions({
          input: { organizationId, siteId },
        }),
        staleTime: 0,
      })
      .catch(fail);
    if (!(loaded && current())) {
      return finish();
    }
    if (loaded.drafts.length === 0) {
      toast.error(messages.noDrafts);
      return finish();
    }
    setState({ scope, files: loaded, preparing: false });
    return true;
  };

  return {
    files: state?.scope === scope ? state.files : null,
    preparing: state?.scope === scope && state.preparing,
    open,
    close: () => setState(null),
  };
}
