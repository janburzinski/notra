import {
  AiBrowserIcon,
  AiChat01Icon,
  Analytics01Icon,
  Building03Icon,
  ChartAnalysisIcon,
  Comment01Icon,
  Home01Icon,
  Key01Icon,
  Layers01Icon,
  MagicWand01Icon,
  Message01Icon,
  NoteIcon,
  PaintBoardIcon,
  PencilEdit01Icon,
  PlugIcon,
  PlusSignIcon,
  Rocket01Icon,
  Robot01Icon,
  SearchList01Icon,
  Settings01Icon,
  UserGroupIcon,
  WebDesign01Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import {
  GEO_AGENT_READINESS_NAV_LINK,
  GEO_GAPS_NAV_LINK,
  GEO_PROMPTS_NAV_LINK,
} from "@notra/geo-core/constants/geo";
import { GEO_PERSONAS_NAV_LINK } from "@notra/geo-core/constants/geo-personas";
import type { PostStatus } from "@notra/schemas/dashboard/content";
import { DURATION } from "@notra/ui/lib/motion";

import { AGENT_FEEDBACK_NAV_LINK } from "@/constants/agent-feedback";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import { SITES_NAV_LINK } from "@/constants/sites";
import type {
  NavGroup,
  NavMainItem,
  NavPrimaryActionConfig,
  SidebarSwapMotion,
  SidebarSwapMotionConfig,
  NavVisibility,
} from "@/types/components/nav";

export const CHAT_NAV_LINK = "/chat";
const CONTENT_NAV_LINK = "/content";
export const ANALYTICS_NAV_LINK = "/analytics";
const BRAND_IDENTITY_NAV_LINK = "/brand/identity";
const AUTOMATIONS_NAV_LINK = "/automation";
const INTEGRATIONS_NAV_LINK = "/integrations";
const SKILLS_NAV_LINK = "/skills";
const API_KEYS_NAV_LINK = "/api-keys";
export const GEO_OVERVIEW_NAV_LINK = "/geo";
export const GEO_TRAFFIC_NAV_LINK = "/geo/traffic";
export const GEO_COMPETITORS_NAV_LINK = "/geo/competitors";
const GEO_SHELF_SPACE_NAV_LINK = "/geo/shelf-space";
export const GEO_SETTINGS_NAV_LINK = "/geo/settings";

export const SIDEBAR_DEFAULT_WIDTH = 256;
/** Matches `--transition-duration-slow`, the sidebar width transition. */
export const SIDEBAR_TRANSITION_MS = 300;
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_RESIZE_STEP = 8;
export const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar_width";

export const NAV_MAIN_ITEMS: NavMainItem[] = [
  { link: CHAT_NAV_LINK, icon: Message01Icon, labelKey: "chat" },
  { link: CONTENT_NAV_LINK, icon: NoteIcon, labelKey: "content" },
  { link: SITES_NAV_LINK, icon: WebDesign01Icon, labelKey: "sites" },
  {
    link: AGENT_FEEDBACK_NAV_LINK,
    icon: Comment01Icon,
    labelKey: "feedback",
  },
  {
    link: BRAND_IDENTITY_NAV_LINK,
    icon: PaintBoardIcon,
    labelKey: "brandIdentityTitle",
  },
  { link: AUTOPILOT_NAV_LINK, icon: Rocket01Icon, labelKey: "autopilot" },
  {
    link: AUTOMATIONS_NAV_LINK,
    icon: WorkflowSquare03Icon,
    labelKey: "automations",
  },
  { link: INTEGRATIONS_NAV_LINK, icon: PlugIcon, labelKey: "integrations" },
  { link: GEO_OVERVIEW_NAV_LINK, icon: AiBrowserIcon, labelKey: "overview" },
  { link: GEO_TRAFFIC_NAV_LINK, icon: Analytics01Icon, labelKey: "analytics" },
  { link: GEO_PROMPTS_NAV_LINK, icon: AiChat01Icon, labelKey: "prompts" },
  { link: GEO_GAPS_NAV_LINK, icon: SearchList01Icon, labelKey: "contentGaps" },
  {
    link: GEO_SHELF_SPACE_NAV_LINK,
    icon: Layers01Icon,
    labelKey: "shelfSpace",
  },
  {
    link: GEO_AGENT_READINESS_NAV_LINK,
    icon: Robot01Icon,
    labelKey: "agentReadiness",
  },
  {
    link: GEO_COMPETITORS_NAV_LINK,
    icon: ChartAnalysisIcon,
    labelKey: "competitors",
  },
  {
    link: GEO_PERSONAS_NAV_LINK,
    icon: UserGroupIcon,
    labelKey: "personas",
    badge: "beta",
  },
  {
    link: GEO_SETTINGS_NAV_LINK,
    icon: Settings01Icon,
    labelKey: "geoSettings",
  },
  { link: SKILLS_NAV_LINK, icon: MagicWand01Icon, labelKey: "skills" },
  { link: API_KEYS_NAV_LINK, icon: Key01Icon, labelKey: "apiKeys" },
];

/** Pages without a row of their own that light up another row's link. */
export const NAV_ACTIVE_LINK_ALIASES: Readonly<Record<string, string>> = {
  [ANALYTICS_NAV_LINK]: GEO_TRAFFIC_NAV_LINK,
};

export const NAV_GEO_IMPROVE_LINKS: readonly string[] = [
  GEO_GAPS_NAV_LINK,
  GEO_SHELF_SPACE_NAV_LINK,
  GEO_AGENT_READINESS_NAV_LINK,
  CONTENT_NAV_LINK,
  AUTOMATIONS_NAV_LINK,
];

/**
 * Main navigation. One row per job: the row opens its first page and reveals
 * the related pages underneath while one of them is active.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "overview",
    icon: Home01Icon,
    labelKey: "overview",
    links: [GEO_OVERVIEW_NAV_LINK, GEO_TRAFFIC_NAV_LINK],
  },
  {
    id: "agentChat",
    icon: Message01Icon,
    labelKey: "agentChat",
    links: [CHAT_NAV_LINK],
  },
  {
    id: "prompts",
    icon: AiChat01Icon,
    labelKey: "prompts",
    links: [GEO_PROMPTS_NAV_LINK, GEO_PERSONAS_NAV_LINK],
  },
  {
    id: "competitors",
    icon: ChartAnalysisIcon,
    labelKey: "competitors",
    links: [GEO_COMPETITORS_NAV_LINK, GEO_SHELF_SPACE_NAV_LINK],
  },
  {
    id: "improve",
    icon: SearchList01Icon,
    labelKey: "improve",
    links: [GEO_GAPS_NAV_LINK, GEO_AGENT_READINESS_NAV_LINK],
  },
  {
    id: "automations",
    icon: WorkflowSquare03Icon,
    labelKey: "automations",
    links: [AUTOMATIONS_NAV_LINK],
  },
  {
    id: "content",
    icon: NoteIcon,
    labelKey: "content",
    links: [CONTENT_NAV_LINK],
  },
  {
    id: "sites",
    icon: WebDesign01Icon,
    labelKey: "sites",
    links: [SITES_NAV_LINK],
  },
  {
    id: "feedback",
    icon: Comment01Icon,
    labelKey: "feedback",
    links: [AGENT_FEEDBACK_NAV_LINK],
  },
  {
    id: "autopilot",
    icon: Rocket01Icon,
    labelKey: "autopilot",
    links: [AUTOPILOT_NAV_LINK],
  },
];

export const NAV_WORKSPACE_GROUP: NavGroup = {
  id: "workspace",
  icon: Building03Icon,
  labelKey: "workspace",
  listsOwnPage: true,
  links: [
    BRAND_IDENTITY_NAV_LINK,
    INTEGRATIONS_NAV_LINK,
    SKILLS_NAV_LINK,
    API_KEYS_NAV_LINK,
  ],
};

export const DEFAULT_NAV_VISIBILITY: NavVisibility = {
  autopilot: false,
  analytics: true,
  sites: false,
};

const SIDEBAR_SWAP_ENTER_TIMING = "duration-normal ease-out";
const SIDEBAR_SWAP_EXIT_TIMING = "duration-fast ease-out";
// Both panels of a push move as one strip, so they share a single timing.
const SIDEBAR_SWAP_PUSH_TIMING =
  "duration-(--sidebar-push-duration) ease-(--sidebar-push-ease)";
// Reduced motion turns every transition into a short fade; the leaving panel
// hides at once so the two never show on top of each other.
const SIDEBAR_SWAP_PUSH_EXIT_REDUCED = "motion-reduce:invisible";
/** Mirrors `--sidebar-push-duration`. */
const SIDEBAR_SWAP_PUSH_MS = 400;

/**
 * `fade` nudges the panels 20px and crossfades them in place. `push` slides
 * them a full width side by side, like drilling into a page, so the two never
 * overlap. Push needs a parent that clips horizontally.
 */
export const SIDEBAR_SWAP_MOTION = {
  fade: {
    enterClass: `z-10 translate-x-0 opacity-100 ${SIDEBAR_SWAP_ENTER_TIMING}`,
    exitLeftClass: `pointer-events-none z-0 -translate-x-5 opacity-0 ${SIDEBAR_SWAP_EXIT_TIMING}`,
    exitRightClass: `pointer-events-none z-0 translate-x-5 opacity-0 ${SIDEBAR_SWAP_EXIT_TIMING}`,
    exitMs: DURATION.fast * 1000,
  },
  push: {
    enterClass: `z-10 translate-x-0 opacity-100 ${SIDEBAR_SWAP_PUSH_TIMING}`,
    exitLeftClass: `pointer-events-none z-0 -translate-x-full opacity-0 ${SIDEBAR_SWAP_PUSH_EXIT_REDUCED} ${SIDEBAR_SWAP_PUSH_TIMING}`,
    exitRightClass: `pointer-events-none z-0 translate-x-full opacity-0 ${SIDEBAR_SWAP_PUSH_EXIT_REDUCED} ${SIDEBAR_SWAP_PUSH_TIMING}`,
    exitMs: SIDEBAR_SWAP_PUSH_MS,
  },
} as const satisfies Record<SidebarSwapMotion, SidebarSwapMotionConfig>;

/** A frame callback running this far behind its frame time came after a long task. */
export const SIDEBAR_SWAP_STALE_FRAME_MS = 24;

/** Upper bound for holding the scroll between a route change and the trade. */
export const SIDEBAR_SWAP_PRE_TRADE_HOLD_MS = 1000;

const SIDEBAR_MODE_FADE_CLASS =
  "transition-[opacity,translate] will-change-[opacity,translate] motion-reduce:translate-x-0 motion-reduce:transition-opacity";

export const SIDEBAR_MODE_PANEL_CLASS = `flex min-h-0 w-full flex-col ${SIDEBAR_MODE_FADE_CLASS}`;

export const ORG_SWITCH_STATIC_PAGE_SECTIONS: ReadonlySet<string> = new Set([
  "geo",
  "automation",
  "brand",
]);
