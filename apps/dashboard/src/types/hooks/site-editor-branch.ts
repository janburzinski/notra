import type { useSiteEditorSaves } from "@/lib/hooks/use-site-editor-saves";
import type { SiteBranchEditorProps } from "@/types/site-branches";
import type { SiteScope } from "@/types/sites";

export interface UseSiteEditorBranchParams extends SiteScope {
  productionBranch: string;
  filesError: unknown;
  draftVersion: string;
  draftCount: number;
  saves: ReturnType<typeof useSiteEditorSaves>;
  onFlushed: () => void;
  onConflict: (paths: string[]) => void;
  onSwitch: SiteBranchEditorProps["onSwitch"];
}
