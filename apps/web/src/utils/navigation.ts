import {
  AiSearch02Icon,
  BookOpen01Icon,
  BrowserIcon,
  FavouriteIcon,
  Megaphone01Icon,
  QuillWrite01Icon,
  Robot01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { REPORTS_NAV } from "@/constants/reports-navigation";

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
  layout?: "compact";
  panel?: "products" | "resources" | "reports";
  label: string;
  cardsHeading: string;
  cards: readonly MarketingNavCard[];
  railHeading: string;
  rail: readonly MarketingNavRailItem[];
}

interface MarketingNavLink {
  type: "link";
  href: string;
  label: string;
}

export type MarketingNavEntry = MarketingNavGroup | MarketingNavLink;

export const MARKETING_NAV: readonly MarketingNavEntry[] = [
  {
    type: "group",
    panel: "products",
    label: "Products",
    cardsHeading: "Product",
    cards: [
      {
        href: "/features",
        label: "AI Search",
        description: "Your place in ChatGPT, Claude and Perplexity.",
        icon: AiSearch02Icon,
      },
      {
        href: "/features/ai-crawler-logs",
        label: "AI Crawler Logs",
        description: "Every AI bot that reads your site, and why.",
        icon: Robot01Icon,
      },
      {
        href: "/features/sites",
        label: "Sites",
        description: "Host your blog and changelog from GitHub.",
        icon: BrowserIcon,
      },
    ],
    railHeading: "Developers",
    rail: [],
  },
  {
    type: "group",
    panel: "resources",
    label: "Resources",
    cardsHeading: "Resources",
    cards: [
      {
        href: "/blog",
        label: "Blog",
        description: "Writing on GEO, AI search and DX.",
        icon: QuillWrite01Icon,
      },
      {
        href: "/changelog/notra",
        label: "Changelog",
        description: "Overview of latest Notra changes.",
        icon: Megaphone01Icon,
      },
      {
        href: "/contributors",
        label: "Contributors",
        description: "People building Notra in the open.",
        icon: UserGroupIcon,
      },
    ],
    railHeading: "More",
    rail: [
      {
        href: "https://www.usenotra.com/docs",
        label: "Docs",
        description: "Guides, API and setup.",
        icon: BookOpen01Icon,
        external: true,
      },
      {
        href: "https://www.notrareviews.com/",
        label: "Reviews",
        description: "What teams say about Notra.",
        icon: FavouriteIcon,
        external: true,
      },
    ],
  },
  REPORTS_NAV,
  { type: "link", href: "/pricing", label: "Pricing" },
];
