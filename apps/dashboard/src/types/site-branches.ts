import type { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteScope } from "@/types/sites";

export type SiteBranchStatus = Awaited<
  ReturnType<typeof dashboardOrpc.sites.branches.status.call>
>;
export type SiteBranchEntry = Awaited<
  ReturnType<typeof dashboardOrpc.sites.branches.list.call>
>[number];

export interface SiteBranchControlsProps extends SiteScope {
  productionBranch: string;
  draftCount: number;
  draftVersion: string;
  unsaved: boolean;
  onSwitch: (branch: string) => Promise<void>;
  onPublish: () => void;
  onFlush: () => Promise<void>;
}

export interface SiteBranchOptionsMenuProps {
  disabled: boolean;
  showBranches: boolean;
  onNewBranch: () => void;
}

export interface SiteBranchDialogProps {
  action: {
    kind: "create" | "rename" | "delete" | "discardDeleted";
    branch: string;
  } | null;
  draftCount: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: (title: string, bringChanges: boolean) => void;
}

export interface SiteBranchMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
  productionBranch: string;
  entries: SiteBranchEntry[];
  loading: boolean;
  disabled: boolean;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (branch: string) => void;
  onAction: (action: NonNullable<SiteBranchDialogProps["action"]>) => void;
}

export interface SiteBranchEditorProps {
  branch?: string;
  onSwitch: (branch: string | null) => Promise<void>;
}

export interface SiteBranchPrimaryActionProps {
  feature: boolean;
  status?: SiteBranchStatus;
  busy: boolean;
  invalid: boolean;
  draftCount: number;
  unsaved: boolean;
  onCreate: () => void;
  onPublish: () => void;
  onFlush: () => void;
  onReview: (merge: boolean) => void;
}

export interface SiteBranchEditInput {
  title: string;
  bringChanges: boolean;
}

export interface SiteBranchPrimaryState {
  action: "create" | "publish" | "requestReview" | "merge";
  disabled: boolean;
  showSave: boolean;
}
