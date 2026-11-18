import type { IconSvgElement } from "@hugeicons/react";
import type { TargetAndTransition, Transition, Variants } from "motion/react";
import type { ReactNode } from "react";
import type { Messages } from "use-intl";

type NavbarGroupId = Extract<keyof Messages["navbar"]["groups"], string>;

type NavbarItemId = Extract<keyof Messages["navbar"]["items"], string>;

export type ReportCategoryId = Extract<
  keyof Messages["navbar"]["reports"]["categories"],
  string
>;

export interface MarketingNavItemConfig {
  id: NavbarItemId;
  href: string;
  icon: IconSvgElement;
  external?: boolean;
}

export interface MarketingNavGroupConfig {
  type: "group";
  id: NavbarGroupId;
  layout?: "compact";
  panel?: "products" | "resources" | "reports";
  cards: readonly MarketingNavItemConfig[];
  rail: readonly MarketingNavItemConfig[];
}

interface MarketingNavLinkConfig {
  type: "link";
  id: NavbarGroupId;
  href: string;
}

export type MarketingNavEntryConfig =
  | MarketingNavGroupConfig
  | MarketingNavLinkConfig;

export interface ReportNavCategory {
  slug: string;
  subject: string;
  href: string;
  icon: IconSvgElement;
}

export interface MarketingNavCard {
  href: string;
  label: string;
  description: string;
  icon: IconSvgElement;
  external?: boolean;
}

export interface MarketingNavRailItem {
  href: string;
  label: string;
  description?: string;
  icon: IconSvgElement;
  external?: boolean;
}

export interface MarketingNavGroup {
  type: "group";
  id: NavbarGroupId;
  layout?: "compact";
  panel?: "products" | "resources" | "reports";
  label: string;
  cards: readonly MarketingNavCard[];
  rail: readonly MarketingNavRailItem[];
}

interface MarketingNavLink {
  type: "link";
  id: NavbarGroupId;
  href: string;
  label: string;
}

export type MarketingNavEntry = MarketingNavGroup | MarketingNavLink;

export type NavbarVariant =
  | "announcement"
  | "island"
  | "landing"
  | "page"
  | "pinned"
  | "static";

export type NavbarMobileOverlayLayout = "announcement" | "compact" | "hero";

export interface NavbarProps {
  variant?: NavbarVariant;
}

export interface NavbarContentMotionInput {
  label: string;
  activeGroup: string | null;
  previousGroup: string | null;
  /** 1 when moving right, -1 when moving left, 0 for an instant swap. */
  direction: number;
  contentTransition: Transition;
}

export interface NavbarContentMotion {
  animate: TargetAndTransition;
  transition: Transition;
  visible: boolean;
}

export interface NavbarPanelSize {
  width: number;
  height: number;
  anchorOffset?: number;
}

export interface NavbarAuthActionsProps {
  isAuthenticated: boolean;
  isResolved: boolean;
}

export interface NavbarMobileMenuProps extends NavbarAuthActionsProps {
  open: boolean;
  onNavigate: () => void;
  overlayLayout: NavbarMobileOverlayLayout;
}

export interface NavbarMobileGroupProps {
  group: MarketingNavGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  item: Variants;
  stagger: Variants;
}

export interface NavbarCompactPanelProps {
  group: MarketingNavGroup;
  onSelect: () => void;
  role?: "menuitem";
}

export interface NavbarKbdProps {
  children: string;
  onLight?: boolean;
}

export interface NavbarHrefProps {
  href: string;
  external?: boolean;
  className: string;
  onClick?: () => void;
  children: ReactNode;
  role?: string;
}

export interface NavbarChromePresentation {
  chrome: boolean;
  innerPaddingClass: string;
  overlayLayout: NavbarMobileOverlayLayout;
  positionClass: string;
  rowHeightClass: string;
  shellAnimate: { maxWidth: string; top?: string };
}
