import type { AuthorSocialKind } from "../types/authors";

export const AUTHOR_SOCIAL_LABELS: Record<
  Exclude<AuthorSocialKind, "website">,
  string
> = {
  x: "X",
  linkedin: "LinkedIn",
  github: "GitHub",
  youtube: "YouTube",
};

export const WWW_PREFIX = /^www\./;
