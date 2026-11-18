import {
  AiMagicIcon,
  AiSearch02Icon,
  BookOpen01Icon,
  BrowserIcon,
  FavouriteIcon,
  Megaphone01Icon,
  QuillWrite01Icon,
  Robot01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import { REPORTS_NAV } from "@/constants/reports-navigation";
import type { MarketingNavEntryConfig } from "@/types/navbar";

export const MARKETING_NAV: readonly MarketingNavEntryConfig[] = [
  {
    type: "group",
    id: "products",
    panel: "products",
    cards: [
      { id: "aiSearch", href: "/features", icon: AiSearch02Icon },
      {
        id: "aiCrawlerLogs",
        href: "/features/ai-crawler-logs",
        icon: Robot01Icon,
      },
      { id: "sites", href: "/features/sites", icon: BrowserIcon },
      { id: "autopilot", href: "/features/autopilot", icon: AiMagicIcon },
    ],
    rail: [],
  },
  {
    type: "group",
    id: "resources",
    panel: "resources",
    cards: [
      { id: "blog", href: "/blog", icon: QuillWrite01Icon },
      { id: "changelog", href: "/changelog", icon: Megaphone01Icon },
      { id: "contributors", href: "/contributors", icon: UserGroupIcon },
    ],
    rail: [
      {
        id: "docs",
        href: "https://www.usenotra.com/docs",
        icon: BookOpen01Icon,
        external: true,
      },
      {
        id: "reviews",
        href: "https://www.notrareviews.com/",
        icon: FavouriteIcon,
        external: true,
      },
    ],
  },
  REPORTS_NAV,
  { type: "link", id: "pricing", href: "/pricing" },
];
