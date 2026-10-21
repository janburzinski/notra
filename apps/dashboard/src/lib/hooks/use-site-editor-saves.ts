import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  SiteEditorSaveQueue,
  SiteEditorSaveState,
  SiteEditorDraftResult,
} from "@/types/site-editor";
import type { SiteScope } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import { isSiteEditorUnsaved } from "@/utils/site-editor";
import { createSiteEditorSaveQueue } from "@/utils/site-editor-save-queue";

export function useSiteEditorSaves(
  scope: SiteScope,
  onDraftChange: (
    path: string,
    updatedAt: Date | null,
    draft: SiteEditorDraftResult | null
  ) => void
) {
  const queryClient = useQueryClient();
  const t = useTranslations("sites.editor");
  const [states, setStates] = useState<Record<string, SiteEditorSaveState>>({});
  const queues = useRef(new Map<string, SiteEditorSaveQueue>()).current;
  const scopeKey = `${scope.organizationId}:${scope.siteId}:${scope.branch ?? ""}:`;

  const getQueue = (path: string, generation = 0) => {
    const key = `${scopeKey}${path}:${generation}`;
    const existing = queues.get(key);
    if (existing) {
      return existing;
    }
    const readOptions = dashboardOrpc.sites.editor.read.queryOptions({
      input: { ...scope, path },
    });
    const queue = createSiteEditorSaveQueue({
      save: (input) => dashboardOrpc.sites.editor.saveDraft.call(input),
      discard: async (input) => {
        await dashboardOrpc.sites.editor.discardDraft.call({
          ...scope,
          path,
          ...input,
        });
      },
      onSaved: (input, result) => {
        queryClient.setQueryData(readOptions.queryKey, (current) =>
          current
            ? {
                ...current,
                content: input.content,
                hasDraft: true,
                draftId: result.draftId,
                draftRevision: result.draftRevision,
              }
            : current
        );
        onDraftChange(path, new Date(result.updatedAt), result);
      },
      onDiscarded: async () => {
        queryClient.setQueryData(readOptions.queryKey, (current) =>
          current
            ? {
                ...current,
                content: current.published ?? "",
                hasDraft: false,
                draftId: null,
                draftRevision: null,
                blobSha: current.publishedBlobSha,
              }
            : current
        );
        onDraftChange(path, null, null);
        await queryClient.invalidateQueries({ queryKey: readOptions.queryKey });
      },
      onStateChange: (state) =>
        setStates((current) => ({ ...current, [key]: state })),
      errorMessage: (error) => toErrorMessage(error, t("saveFailed")),
    });
    queues.set(key, queue);
    return queue;
  };

  return {
    getQueue,
    flush: async () => {
      const active = [...queues.entries()]
        .filter(([key]) => key.startsWith(scopeKey))
        .map(([, queue]) => queue);
      await Promise.all(active.map((queue) => queue.flush()));
      if (
        active.some((queue) => isSiteEditorUnsaved(queue.getSnapshot().state))
      ) {
        throw new Error(t("saveFailed"));
      }
    },
    unsaved: Object.entries(states).some(
      ([key, state]) => key.startsWith(scopeKey) && isSiteEditorUnsaved(state)
    ),
    reset: () => {
      queues.clear();
      setStates({});
    },
    resetClean: (paths: readonly string[]) => {
      const removed = paths.filter((path) => {
        const entries = [...queues].filter(([key]) =>
          key.startsWith(`${scopeKey}${path}:`)
        );
        if (
          entries.length === 0 ||
          entries.some(([, queue]) =>
            isSiteEditorUnsaved(queue.getSnapshot().state)
          )
        ) {
          return false;
        }
        for (const [key] of entries) {
          queues.delete(key);
        }
        return true;
      });
      if (removed.length > 0) {
        setStates((current) => {
          const next = { ...current };
          for (const path of removed) {
            for (const key of Object.keys(next)) {
              if (key.startsWith(`${scopeKey}${path}:`)) {
                delete next[key];
              }
            }
          }
          return next;
        });
      }
      return removed;
    },
  };
}
