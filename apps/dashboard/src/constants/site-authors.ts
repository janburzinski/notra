import { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";

/**
 * Marks an entry of a post's `authorIds` as an id from the site's blog.json
 * `authors` rather than a Notra author row, e.g. `site:jan`.
 */
export const SITE_AUTHOR_REF_PREFIX = "site:";

/** Every field of a blog.json author, in the order Notra writes them. */
export const SITE_AUTHOR_FIELDS = [
  "name",
  "title",
  "avatar",
  "bio",
  ...CONTENT_AUTHOR_LINK_FIELDS,
] as const;

/** blog.json allows shorter bios than Notra authors. */
export const SITE_AUTHOR_BIO_MAX_LENGTH = 300;

export const SITE_AUTHOR_PAGE_LAYOUTS = ["inline", "stacked"] as const;

export const TRAILING_SLASHES = /\/+$/;

/** Opens the new-author form when linked to the Authors section with `?author=new`. */
export const SITE_AUTHOR_NEW_PARAM = "new";

/** Ids written unquoted in frontmatter, as in `author: jan`. */
export const SITE_AUTHOR_YAML_PLAIN = /^[a-z][a-z0-9-]*$/;

/** Ids YAML could read as something other than a string, so they stay quoted. */
export const SITE_AUTHOR_YAML_RESERVED = new Set([
  "true",
  "false",
  "null",
  "yes",
  "no",
  "on",
  "off",
  "y",
  "n",
]);
