import type { MarketingNavGroup, NavbarPanelSize } from "@/types/navbar";

export function isCompactNavbarPanel(group: MarketingNavGroup | undefined) {
  return group?.layout === "compact" && !group.panel;
}

export function getNavbarPanelX(
  size: NavbarPanelSize | undefined,
  compact: boolean
) {
  const anchor = compact ? (size?.anchorOffset ?? 0) : 0;
  return anchor - (size?.width ?? 0) / 2;
}
