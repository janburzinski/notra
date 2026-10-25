import type { SitePullRequestTone } from "@/types/site-branches";

export const SITE_PUBLISH_MESSAGE_MAX_LENGTH = 200;

export const SITE_PULL_REQUEST_TONE_BADGES = {
  success: "success",
  warning: "warning",
  destructive: "destructive",
  muted: "secondary",
} as const satisfies Record<SitePullRequestTone, string>;
