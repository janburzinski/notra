import type {
  SiteEditorDocument,
  SiteEditorFiles,
} from "../../src/types/sites";

export interface WorkspaceFixtureRecord {
  document: SiteEditorDocument;
  files: SiteEditorFiles;
}

export interface WorkspaceFixtureBlocker {
  disabled: boolean;
  shouldBlockFn: () => Promise<boolean>;
}
