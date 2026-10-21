import type { ReactNode } from "react";

import { SiteEditorEmptyState } from "@/components/sites/editor/site-editor-empty-state";
import { SiteEditorFilesError } from "@/components/sites/editor/site-editor-files-error";
import { SiteEditorPane } from "@/components/sites/editor/site-editor-pane";
import type { SiteEditorSurfaceProps } from "@/types/components/site-editor";

export function SiteEditorSurface({
  filesQuery,
  selectedPath,
  branch,
  site,
  siteId,
  organizationId,
  baseCommitSha,
  diagnostics,
  jump,
  editorEpoch,
  saves,
  canCreateFile,
  onChooseFile,
  onNewFile,
}: SiteEditorSurfaceProps) {
  let editorSurface: ReactNode;
  if (filesQuery.isError && filesQuery.data === undefined) {
    editorSurface = (
      <SiteEditorFilesError
        error={filesQuery.error}
        onRetry={() => {
          void filesQuery.refetch();
        }}
      />
    );
  } else if (selectedPath) {
    editorSurface = (
      <SiteEditorPane
        editEpoch={editorEpoch}
        branch={branch}
        baseCommitSha={baseCommitSha}
        diagnostics={diagnostics}
        jump={jump?.path === selectedPath ? jump : null}
        key={`${organizationId}:${siteId}:${selectedPath}:${editorEpoch}`}
        onOpenFilePicker={onChooseFile}
        saveQueue={saves.getQueue(selectedPath, editorEpoch)}
        organizationId={organizationId}
        path={selectedPath}
        site={site}
        siteId={siteId}
      />
    );
  } else {
    editorSurface = (
      <SiteEditorEmptyState
        canCreateFile={canCreateFile}
        filesLoading={filesQuery.isPending}
        onChooseFile={onChooseFile}
        onNewFile={onNewFile}
      />
    );
  }

  return editorSurface;
}
