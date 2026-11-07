import {
  AiChat01Icon,
  Building03Icon,
  ChartAnalysisIcon,
  Comment01Icon,
  Home01Icon,
  NoteIcon,
  SearchList01Icon,
  WebDesign01Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type {
  SidebarNavGroup,
  SidebarSwitcherOption,
} from "../types/app-sidebar";

export const DEMO_PROJECTS: SidebarSwitcherOption[] = [
  { value: "notra", label: "Notra", description: "usenotra.com", icon: "N" },
  { value: "acme", label: "Acme", description: "acme.dev", icon: "A" },
  { value: "blume", label: "Blume", description: "blume.sh", icon: "B" },
];

/** The navigation of the Notra dashboard. */
export const DEMO_NAV_GROUPS: SidebarNavGroup[] = [
  {
    title: "Overview",
    href: "#home",
    icon: <HugeiconsIcon icon={Home01Icon} />,
    items: [
      { title: "Home", href: "#home" },
      { title: "Traffic", href: "#traffic" },
      { title: "Analytics", href: "#analytics" },
    ],
  },
  {
    title: "Prompts",
    href: "#prompts",
    icon: <HugeiconsIcon icon={AiChat01Icon} />,
    items: [{ title: "Personas", href: "#personas", badge: "Beta" }],
  },
  {
    title: "Competitors",
    href: "#competitors",
    icon: <HugeiconsIcon icon={ChartAnalysisIcon} />,
    items: [{ title: "Shelf Space", href: "#shelf-space" }],
  },
  {
    title: "Improve",
    href: "#content-gaps",
    icon: <HugeiconsIcon icon={SearchList01Icon} />,
    items: [{ title: "Agent Readiness", href: "#agent-readiness" }],
  },
  {
    title: "Automations",
    href: "#automations",
    icon: <HugeiconsIcon icon={WorkflowSquare03Icon} />,
  },
  {
    title: "Content",
    href: "#content",
    icon: <HugeiconsIcon icon={NoteIcon} />,
    items: [{ title: "Chat", href: "#chat" }],
  },
  {
    title: "Sites",
    href: "#sites",
    icon: <HugeiconsIcon icon={WebDesign01Icon} />,
  },
  {
    title: "Feedback",
    href: "#feedback",
    icon: <HugeiconsIcon icon={Comment01Icon} />,
  },
];

export const DEMO_FOOTER_GROUPS: SidebarNavGroup[] = [
  {
    title: "Workspace",
    href: "#brand-identity",
    icon: <HugeiconsIcon icon={Building03Icon} />,
    items: [
      { title: "Brand Identity", href: "#brand-identity" },
      { title: "Integrations", href: "#integrations" },
      { title: "Skills", href: "#skills" },
      { title: "API Keys", href: "#api-keys" },
    ],
  },
];

export const DEMO_PAGE_TITLES: Record<string, string> = Object.fromEntries(
  [...DEMO_NAV_GROUPS, ...DEMO_FOOTER_GROUPS].flatMap((group) => [
    [group.href, group.title],
    ...(group.items ?? []).map((item) => [item.href, item.title]),
  ])
);

/** Dots of the Notra agent mark. */
export const DEMO_AGENT_ICON_DOTS = [
  { cx: 12, cy: 12, r: 2.9 },
  { cx: 12, cy: 5, r: 2.1 },
  { cx: 19, cy: 12, r: 2.1 },
  { cx: 12, cy: 19, r: 2.1 },
  { cx: 5, cy: 12, r: 2.1 },
  { cx: 5, cy: 5, r: 1.35 },
  { cx: 19, cy: 5, r: 1.35 },
  { cx: 19, cy: 19, r: 1.35 },
  { cx: 5, cy: 19, r: 1.35 },
] as const;
