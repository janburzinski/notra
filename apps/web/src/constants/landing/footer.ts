import { Discord } from "@notra/ui/components/ui/svgs/discord";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { Linkedin } from "@notra/ui/components/ui/svgs/linkedin";
import { Reddit } from "@notra/ui/components/ui/svgs/reddit";
import { XTwitter } from "@notra/ui/components/ui/svgs/twitter";
import { Youtube } from "@notra/ui/components/ui/svgs/youtube";

import type {
  FooterDitheringConfig,
  FooterLink,
  FooterLinkColumn,
  FooterSocialLink,
  GlitterTheme,
} from "@/types/landing/footer";
import { SOCIAL_LINKS } from "@/utils/social-links";

export const FOOTER_DITHERING: FooterDitheringConfig = {
  speed: 0.57,
  shape: "wave",
  type: "4x4",
  size: 2.9,
  scale: 0.73,
  colorBack: "#00000000",
  colorFront: "#8B5CF64D",
};

export const FOOTER_SOCIAL_LINKS: readonly FooterSocialLink[] = [
  { label: "X", href: SOCIAL_LINKS.x, Icon: XTwitter },
  { label: "YouTube", href: SOCIAL_LINKS.youtube, Icon: Youtube },
  { label: "LinkedIn", href: SOCIAL_LINKS.linkedin, Icon: Linkedin },
  { label: "Discord", href: SOCIAL_LINKS.discord, Icon: Discord },
  { label: "GitHub", href: SOCIAL_LINKS.github, Icon: Github },
  { label: "Reddit", href: SOCIAL_LINKS.reddit, Icon: Reddit },
];

export const FOOTER_LINK_COLUMNS: readonly FooterLinkColumn[] = [
  {
    groups: [
      {
        id: "product",
        links: [
          { id: "aiTraffic", href: "/features/ai-crawler-logs" },
          { id: "personas", href: "/features/personas" },
          { id: "conversations", href: "/features/conversations" },
          { id: "sites", href: "/features/sites" },
          { id: "freeScan", href: "/features/free-scan" },
          { id: "pricing", href: "/pricing" },
          { id: "compare", href: "/compare" },
          { id: "changelog", href: "/changelog" },
        ],
      },
      {
        id: "integrations",
        links: [
          { id: "marketplace", href: "/integrations" },
          {
            id: "framer",
            href: "https://www.framer.com/marketplace/plugins/notra/",
            external: true,
          },
          {
            id: "raycast",
            href: "https://www.raycast.com/dominikdev/notra",
            external: true,
          },
        ],
      },
    ],
  },
  {
    groups: [
      {
        id: "developers",
        links: [
          {
            id: "geoSdk",
            href: "https://www.npmjs.com/package/@usenotra/sdk",
            external: true,
          },
          {
            id: "docs",
            href: "https://www.usenotra.com/docs",
            external: true,
          },
          {
            id: "cli",
            href: "https://www.usenotra.com/docs/devtools/cli",
            external: true,
          },
          {
            id: "mcpServer",
            href: "/mcp",
          },
        ],
      },
      {
        id: "sources",
        links: [
          { id: "github", href: "/integrations/github" },
          { id: "linear", href: "/integrations/linear" },
          { id: "slack", href: "/integrations/slack" },
          { id: "granola", href: "/integrations/granola" },
        ],
      },
    ],
  },
  {
    groups: [
      {
        id: "company",
        links: [
          { id: "brandAssets", href: "/brand" },
          {
            id: "reviews",
            href: "https://www.notrareviews.com/",
            external: true,
          },
          { id: "contact", href: "/contact" },
        ],
      },
      {
        id: "community",
        links: [
          { id: "stateOfAiSearch", href: "/state-of-ai-search" },
          { id: "stateOfAiTraffic", href: "/data" },
        ],
      },
      {
        id: "freeTools",
        links: [
          { id: "starVideo", href: "/repo-star-video" },
          { id: "ipChecker", href: "/ip-checker" },
          { id: "featureCheck", href: "/offering" },
          { id: "utmBuilder", href: "/utm-builder" },
          { id: "qrCode", href: "/qr-code-generator" },
        ],
      },
    ],
  },
];

export const FOOTER_LEGAL_LINKS: readonly FooterLink[] = [
  { id: "privacy", href: "/privacy" },
  { id: "legal", href: "/legal" },
  { id: "terms", href: "/terms" },
];

export const GLITTER_EGG_CLICKS = 5;
export const GLITTER_EGG_HINT_CLICK = 3;
export const GLITTER_EGG_CLICK_WINDOW_MS = 1200;

export const GLITTER_WORDMARK = {
  text: "NOTRA",
  fontFamily: "NotraGlitter",
  fontUrl: "/fonts/inter-800.woff2",
  columns: 200,
  rows: 48,
  revealMs: 1400,
  maxStars: 24,
  starChance: 0.18,
  hoverStarChance: 0.55,
  starLifeS: 0.7,
  sheenPeriodS: 5,
  sheenWidth: 0.07,
  hoverRadius: 16,
  hoverPush: 1.4,
} as const;

// Gradient stops sampled left to right across the word; the last stop wraps to the first.
export const GLITTER_GRADIENT_DARK: GlitterTheme = {
  stops: [
    [200, 178, 238],
    [167, 139, 250],
    [240, 171, 252],
    [165, 180, 252],
  ],
  highlight: [255, 255, 255],
  floor: 0.55,
};

export const GLITTER_GRADIENT_LIGHT: GlitterTheme = {
  stops: [
    [124, 58, 237],
    [139, 92, 246],
    [192, 38, 211],
    [79, 70, 229],
  ],
  highlight: [255, 246, 252],
  floor: 0.7,
};
