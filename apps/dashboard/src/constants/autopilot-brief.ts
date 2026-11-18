import type { AutopilotBriefHeadings } from "@notra/db/types/autopilot";

/** Every brief has a link at /brief/:id that opens its artifact. */
export const AUTOPILOT_BRIEFS_PATH = "/brief";

export const AUTOPILOT_BRIEF_MAX_SECTIONS = 4;
export const AUTOPILOT_BRIEF_HEADLINE_MAX = 70;
export const AUTOPILOT_BRIEF_SUMMARY_MAX = 400;
export const AUTOPILOT_BRIEF_LEAD_MAX = 240;
export const AUTOPILOT_BRIEF_SECTION_TITLE_MAX = 80;
export const AUTOPILOT_BRIEF_SECTION_BODY_MAX = 900;
export const AUTOPILOT_BRIEF_MAX_OUTPUT_TOKENS = 1500;

/** Brief ids are nanoids; anything else is a 404 before touching the database. */
export const AUTOPILOT_BRIEF_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Items the daily brief card draws from today's brief. */
export const AUTOPILOT_BRIEF_PREVIEW_ITEMS = 2;

/** Posts and pages a pull request writes, shown rendered in the item modal. */
export const AUTOPILOT_CONTENT_FILE_PATTERN = /\.mdx?$/i;
/** Files the item modal reads from one pull request. */
export const AUTOPILOT_CONTENT_MAX_FILES = 30;
export const AUTOPILOT_CONTENT_MAX_POSTS = 3;
export const AUTOPILOT_CONTENT_MAX_OTHER_FILES = 10;
/** Longest patch shown for a non-post file; the rest is on GitHub. */
export const AUTOPILOT_CONTENT_PATCH_MAX_CHARS = 4000;
/** Images a post shows, by extension, read from the pull request for the modal. */
export const AUTOPILOT_CONTENT_IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};
/** Folders a site serves from its root, so `/images/a.png` can live in `public/images`. */
export const AUTOPILOT_CONTENT_STATIC_DIRS = ["public", "static"];
/** Larger images stay on GitHub; GitHub's contents API returns up to 1 MB inline. */
export const AUTOPILOT_CONTENT_IMAGE_MAX_BYTES = 1_000_000;
/** All images one modal read inlines, so the response stays small. */
export const AUTOPILOT_CONTENT_IMAGES_MAX_BYTES = 4_000_000;
/**
 * What an inlined image's source becomes in the post body. The renderer
 * blocks data URLs and rewrites relative paths, but keeps a root path as is.
 */
export const AUTOPILOT_CONTENT_IMAGE_KEY_PREFIX = "/notra-pr-image/";
/** The modal re-reads GitHub at most this often while it stays open. */
export const AUTOPILOT_CONTENT_STALE_MS = 60_000;

/**
 * Headings the brief's artifact puts above its parts. The model translates
 * them into the brand's language; these are the originals and the fallback.
 */
export const AUTOPILOT_BRIEF_ARTIFACT_HEADINGS: AutopilotBriefHeadings = {
  waiting: "Waiting for you",
  alsoWaiting: "Also waiting",
  merged: "Merged",
  worthKnowing: "Worth knowing",
};

export const AUTOPILOT_BRIEF_HEADING_MAX = 40;
