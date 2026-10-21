import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useSite } from "@/components/sites/site-context";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishFilesState } from "@/types/hooks/sites";
import type { SiteScope } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";

/** Loads the site's drafts so the publish dialog can list them. */
export function useSitePublishFiles(messages: {
  noDrafts: string;
  failed: string;
}) {
  const { organizationId, siteId } = useSite();
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

  const open = () => {
    if (activeScope.current !== scope) {
      return;
    }
    setState({ scope, files: null, preparing: true });
    return queryClient
      .fetchQuery({
        ...dashboardOrpc.sites.editor.files.queryOptions({
          input: { organizationId, siteId },
        }),
        staleTime: 0,
      })
      .then(
        (loaded) => {
          if (activeScope.current !== scope) {
            return;
          }
          if (loaded.drafts.length === 0) {
            toast.error(messages.noDrafts);
            return;
          }
          setState({ scope, files: loaded, preparing: false });
        },
        (error: unknown) => {
          if (activeScope.current === scope) {
            toast.error(toErrorMessage(error, messages.failed));
          }
        }
      )
      .then(() => {
        if (activeScope.current === scope) {
          setState((current) => current && { ...current, preparing: false });
        }
      });
  };

  return {
    files: state?.scope === scope ? state.files : null,
    preparing: state?.scope === scope && state.preparing,
    open,
    close: () => setState(null),
  };
}
