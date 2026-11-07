import type { LandingIntro, LandingTile } from "../types/landing";

export const LANDING_INTRO: LandingIntro = {
  description:
    "The building blocks of the Notra dashboard, rendered live with the real styles.",
  // Adds the whole @notra registry to components.json, after which any
  // component installs by name.
  install: {
    items: ["@notra"],
    prefix: "bunx shadcn@latest registry add ",
  },
};

/**
 * Collage order. The grid packs densely, so at four columns this order fills
 * every cell; narrower grids reflow around the big tiles.
 */
export const LANDING_TILES: LandingTile[] = [
  {
    href: "/components/button",
    preview: "button",
    size: "sm",
    title: "Button",
  },
  { preview: "intro", size: "wide" },
  {
    href: "/components/dropdown-menu",
    preview: "dropdown-menu",
    size: "tall",
    title: "Dropdown Menu",
  },
  {
    href: "/components/badges",
    preview: "badges",
    size: "wide",
    title: "Status & Trend Badges",
  },
  {
    href: "/components/sidebar",
    preview: "sidebar",
    size: "tall",
    title: "Sidebar",
  },
  {
    href: "/components/composer",
    preview: "composer",
    size: "wide",
    title: "Composer",
  },
  {
    href: "/components/tooltip",
    preview: "tooltip",
    size: "sm",
    title: "Tooltip",
  },
  {
    href: "/components/shimmer",
    preview: "shimmer",
    size: "sm",
    title: "Shimmer",
  },
  {
    href: "/components/icon-tabs",
    preview: "icon-tabs",
    size: "sm",
    title: "Icon Tabs",
  },
  {
    href: "/components/sonner",
    preview: "sonner",
    scale: 0.85,
    size: "sm",
    title: "Sonner",
  },
  {
    href: "/components/step-slider",
    preview: "step-slider",
    size: "sm",
    title: "Step Slider",
  },
  {
    href: "/components/table",
    preview: "data-table",
    size: "wide",
    title: "Data Table",
  },
  {
    href: "/components/select",
    preview: "select",
    size: "sm",
    title: "Select",
  },
  {
    href: "/components/marketing-button",
    preview: "marketing-button",
    size: "sm",
    title: "Marketing Button",
  },
  {
    href: "/components/chat-minimap",
    preview: "chat-minimap",
    size: "wide",
    title: "Chat Minimap",
  },
  {
    href: "/components/duotone-tooltip",
    preview: "duotone-tooltip",
    size: "wide",
    title: "Duotone Tooltip",
  },
  {
    href: "/blocks/workflow-builder",
    preview: "workflow-builder",
    size: "wide",
    title: "Workflow Builder",
  },
  {
    href: "/components/workflow/node",
    preview: "workflow-node",
    size: "sm",
    title: "Workflow Node",
  },
  {
    href: "/blocks/listicle-outreach",
    preview: "listicle-outreach",
    scale: 0.75,
    size: "sm",
    title: "Listicle Outreach",
  },
];
