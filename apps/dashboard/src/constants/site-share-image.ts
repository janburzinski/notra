import type { SiteArea } from "@notra/sites-core/types/deployment";

export const SITE_THUMBNAIL_LAYOUTS = ["default", "author", "article"] as const;
export const SITE_THUMBNAIL_APPEARANCES = ["light", "dark"] as const;
export const SITE_SHARE_PREVIEW_PAGES = ["post", "home"] as const;

/** blog.json keys a share image reads; the preview sends only these. */
export const SITE_SHARE_PREVIEW_CONFIG_KEYS = [
  "name",
  "description",
  "logo",
  "favicon",
  "colors",
  "thumbnails",
  "seo",
  "authors",
  "blog",
  "changelog",
] as const;

export const SITE_SHARE_PREVIEW_DEBOUNCE_MS = 300;

/** The post the preview draws; without tags, so the label shows as its category. */
export const SITE_SHARE_PREVIEW_POST = {
  title: "How we cut our build times in half",
  description:
    "Caching, smaller images and one less round trip on every deploy.",
  tags: [],
} as const;

/** Stands in when blog.json lists no authors. */
export const SITE_SHARE_PREVIEW_AUTHOR = {
  name: "Alex Morgan",
  title: "Staff engineer",
} as const;

export const SITE_AREA_DEFAULT_TITLES: Record<SiteArea, string> = {
  blog: "Blog",
  changelog: "Changelog",
};
