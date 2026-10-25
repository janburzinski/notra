import type {
  SiteBranchPrimaryActionProps,
  SiteBranchPrimaryState,
} from "@/types/site-branches";

export function siteBranchPrimaryState({
  feature,
  status,
  busy,
  invalid,
  draftCount,
  unsaved,
  saving,
}: SiteBranchPrimaryActionProps): SiteBranchPrimaryState {
  // Hold the expected action while the status loads instead of flashing
  // Create branch on a branch that may well be editable.
  if (!status) {
    return {
      action: feature ? "requestReview" : "publish",
      disabled: true,
      showSave: feature && draftCount > 0,
    };
  }
  if (feature ? !status.canEdit : !status.canPublishDirect) {
    return { action: "create", disabled: busy || unsaved, showSave: false };
  }
  if (!feature) {
    return {
      action: "publish",
      disabled:
        busy ||
        invalid ||
        (draftCount === 0 && !saving) ||
        !status?.canPublishDirect,
      showSave: false,
    };
  }
  const pr = status?.pullRequest;
  const canReview = pr?.state === "OPEN" && pr.isDraft;
  return {
    action: !pr || pr.state !== "OPEN" || canReview ? "requestReview" : "merge",
    disabled:
      busy || invalid || draftCount > 0 || !(canReview || status?.canMerge),
    showSave: draftCount > 0,
  };
}
