import type { ChartConfig } from "@notra/ui/components/ui/chart";

export const OVERVIEW_RANGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

export const OVERVIEW_DEFAULT_DAYS = 30;
export const OVERVIEW_MAX_DAYS = 90;
export const OVERVIEW_REFETCH_MS = 5 * 60_000;
export const OVERVIEW_TOP_WORKSPACES_LIMIT = 10;

export const OVERVIEW_GROWTH_CONFIG = {
  signups: { label: "Signups", color: "var(--chart-1)" },
  workspaces: { label: "New workspaces", color: "var(--chart-2)" },
} satisfies ChartConfig;

export const OVERVIEW_USAGE_CONFIG = {
  content: { label: "Content written", color: "var(--chart-1)" },
  scans: {
    label: "GEO scans",
    theme: {
      light: "oklch(0.696 0.17 162.48)",
      dark: "oklch(0.765 0.177 163.22)",
    },
  },
  chats: {
    label: "Chats",
    theme: {
      light: "oklch(0.769 0.188 70.08)",
      dark: "oklch(0.828 0.189 84.429)",
    },
  },
} satisfies ChartConfig;

export const OVERVIEW_CONTENT_TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog post",
  changelog: "Changelog",
  linkedin_post: "LinkedIn post",
  twitter_post: "X post",
  investor_update: "Investor update",
  image: "Image",
};

export const OVERVIEW_SIGNUP_SOURCE_LABELS: Record<string, string> = {
  x: "X",
  github: "GitHub",
  linkedin: "LinkedIn",
  search: "Search",
  blog_or_newsletter: "Blog or newsletter",
  friend_or_colleague: "Friend or colleague",
  other: "Other",
  unknown: "Not answered",
};
