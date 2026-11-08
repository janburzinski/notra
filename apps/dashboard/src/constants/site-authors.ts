import { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";
import type { SiteAuthorFormError } from "@/types/site-authors";

/** Every field of a blog.json author, in the order Notra writes them. */
export const SITE_AUTHOR_FIELDS = [
  "name",
  "title",
  "avatar",
  "bio",
  ...CONTENT_AUTHOR_LINK_FIELDS,
] as const;

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

/** Why the public API refused an author, by form error. */
export const SITE_AUTHOR_ERROR_MESSAGES: Record<SiteAuthorFormError, string> = {
  required: "is required",
  tooLong: "is too long",
  idFormat:
    "use 1 to 40 lowercase letters, digits and dashes, starting and ending with a letter or digit",
  idTaken: "another author already uses this id",
  avatar: "use a site path like /images/jane.png or an https:// URL",
  https: "use a full https:// URL",
};
