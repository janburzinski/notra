import { SITE_BRANCH_VISIBILITY_KEY } from "@/constants/site-branches";

export function subscribeSiteBranchVisibility(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(SITE_BRANCH_VISIBILITY_KEY, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(SITE_BRANCH_VISIBILITY_KEY, listener);
  };
}

export function siteBranchVisibility() {
  return localStorage.getItem(SITE_BRANCH_VISIBILITY_KEY) === "true";
}

export function toggleSiteBranchVisibility() {
  localStorage.setItem(
    SITE_BRANCH_VISIBILITY_KEY,
    String(!siteBranchVisibility())
  );
  window.dispatchEvent(new Event(SITE_BRANCH_VISIBILITY_KEY));
}

export function serverSiteBranchVisibility() {
  return false;
}
