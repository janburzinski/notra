import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { useBlocker } from "@tanstack/react-router";
import { useState } from "react";

import { useSite } from "@/components/sites/site-context";
import { useRebaseSiteDrafts } from "@/lib/hooks/use-rebase-site-drafts";
import { useSiteBranchControls } from "@/lib/hooks/use-site-branch-controls";
import { useSiteDraftSaves } from "@/lib/hooks/use-site-draft-saves";
import { useSiteWorkingBranch } from "@/lib/hooks/use-site-working-branch";
import { useWarnBeforeUnload } from "@/lib/hooks/use-warn-before-unload";
import type { SiteRawConfig } from "@/types/site-design";
import type { SiteVariableRow } from "@/types/site-variables";
import type { SiteWorkspaceReadyProps } from "@/types/site-workspace";
import { serializeSiteConfig } from "@/utils/site-design";
import {
  parseDesignSource,
  designIssues,
  validDesignSource,
} from "@/utils/site-design-sections";
import { siteDraftVersion } from "@/utils/site-draft-version";
import { validateVariableRows } from "@/utils/site-variables";

export function useSiteWorkspaceState({
  document,
  comparisonContent,
  files,
  refreshing = false,
  branch,
  onSwitch,
  onDraftChange,
  onRefresh,
}: SiteWorkspaceReadyProps) {
  const { organizationId, siteId, detail } = useSite();
  const scope = { organizationId, siteId, branch };
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [recovering, setRecovering] = useState(false);
  const saves = useSiteDraftSaves(scope, onDraftChange, setConflicts);
  const [buffer, setBuffer] = useState<SiteRawConfig | null>(null);
  const [snapshot, setSnapshot] = useState(document);
  const [variableRows, setVariableRows] = useState<SiteVariableRow[]>(() =>
    Object.entries(parseDesignSource(document.content).variables ?? {}).map(
      ([name, value]) => ({ id: name, name, value: String(value) })
    )
  );
  const [variableError, setVariableError] = useState<
    "invalid" | "duplicate" | null
  >(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const malformed = !validDesignSource(document.content);
  const config = buffer ?? parseDesignSource(document.content);
  const issues = designIssues(config);
  const invalid = issues.length > 0 || variableError !== null;
  const unsaved = saves.unsaved || invalid;
  const drafts = files.drafts;
  const draftVersion = siteDraftVersion(drafts);
  const branchState = useSiteWorkingBranch({
    ...scope,
    productionBranch: detail.site.productionBranch,
    filesError: null,
    draftVersion,
    draftCount: drafts.length,
    saves: { ...saves, unsaved },
    onFlushed: () => {
      if (saves.resetClean([SITE_CONFIG_FILENAME]).length > 0) {
        setBuffer(null);
      }
    },
    onConflict: setConflicts,
    onSwitch,
  });
  useWarnBeforeUnload(unsaved);
  useBlocker({
    disabled: !unsaved,
    enableBeforeUnload: false,
    shouldBlockFn: async () => {
      if (invalid || conflicts.length > 0 || readOnly) {
        return true;
      }
      return saves.flush().then(
        () => false,
        () => true
      );
    },
  });
  const controller = useSiteBranchControls({
    ...scope,
    productionBranch: detail.site.productionBranch,
    draftCount: drafts.length,
    draftVersion,
    unsaved,
    saveState: saves.state,
    commitStatus: branchState.commitStatus,
    onSwitch: branchState.switchBranch,
    onFlush: async () => {
      if (invalid || conflicts.length > 0 || (readOnly && unsaved)) {
        throw new Error("Invalid site configuration");
      }
      if (!readOnly) {
        await branchState.flush();
      }
    },
    onPublish: () => setPublishOpen(true),
  });
  const rebase = useRebaseSiteDrafts({
    ...scope,
    onRebased: () => setConflicts([]),
    onSettled: (paths) => {
      if (saves.resetClean(paths).includes(SITE_CONFIG_FILENAME)) {
        setBuffer(null);
      }
    },
  });
  const readOnly = refreshing || rebase.isPending || recovering;
  if (snapshot !== document && !unsaved) {
    setSnapshot(document);
    setBuffer(null);
    setVariableRows(
      Object.entries(parseDesignSource(document.content).variables ?? {}).map(
        ([name, value]) => ({ id: name, name, value: String(value) })
      )
    );
    saves.resetClean([SITE_CONFIG_FILENAME]);
  }
  const update = (next: SiteRawConfig) => {
    if (malformed || readOnly) {
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(config)) {
      return;
    }
    setBuffer(next);
    if (designIssues(next).length > 0) {
      return;
    }
    saves.getQueue(SITE_CONFIG_FILENAME).edit({
      ...scope,
      path: SITE_CONFIG_FILENAME,
      content: serializeSiteConfig(next),
      baseBlobSha: snapshot.blobSha,
      baseCommitSha: files.commitSha,
      draftId: snapshot.draftId,
      draftRevision: snapshot.draftRevision,
      sourceContext: snapshot.sourceContext,
    });
  };
  const updateVariables = (rows: SiteVariableRow[]) => {
    if (readOnly) {
      return;
    }
    setVariableRows(rows);
    const filled = rows.filter((row) => row.name.trim() || row.value);
    const result = validateVariableRows(filled);
    setVariableError(result.error);
    if (!result.error) {
      update({ ...config, variables: result.variables });
    }
  };
  const resolveConflict = async (keep: boolean) => {
    if (readOnly || saves.state.status === "saving" || (keep && invalid)) {
      return;
    }
    setRecovering(true);
    try {
      let latest = await onRefresh();
      if (keep) {
        await rebase.mutateAsync(conflicts);
        latest = await onRefresh();
      }
      saves.reset();
      setSnapshot(latest.document);
      if (keep) {
        saves.getQueue(SITE_CONFIG_FILENAME).edit({
          ...scope,
          path: SITE_CONFIG_FILENAME,
          content: serializeSiteConfig(config),
          baseBlobSha: latest.document.blobSha,
          baseCommitSha: latest.files.commitSha,
          draftId: latest.document.draftId,
          draftRevision: latest.document.draftRevision,
          sourceContext: latest.document.sourceContext,
        });
        await saves.flush();
      } else {
        setBuffer(null);
        setVariableError(null);
        setVariableRows(
          Object.entries(
            parseDesignSource(latest.document.content).variables ?? {}
          ).map(([name, value]) => ({ id: name, name, value: String(value) }))
        );
      }
      setConflicts([]);
    } catch {
      setConflicts([SITE_CONFIG_FILENAME]);
    }
    setRecovering(false);
  };
  return {
    readOnly,
    rebase,
    malformed,
    variableRows,
    variableError,
    updateVariables,
    config,
    published: parseDesignSource(
      comparisonContent ?? document.published ?? document.content
    ),
    issues,
    update,
    saves,
    unsaved,
    invalid,
    controller,
    publishOpen,
    setPublishOpen,
    conflicts,
    setConflicts,
    resolveConflict,
    scope,
    files,
    document,
    resetPublished: () => {
      saves.resetClean([SITE_CONFIG_FILENAME]);
      setBuffer(null);
    },
  };
}
