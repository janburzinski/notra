import {
  SITE_AUTHOR_ID,
  SITE_AUTHOR_REF_PREFIX,
} from "@notra/sites-core/constants/site-config";

export function siteAuthorRef(id: string): string {
  return `${SITE_AUTHOR_REF_PREFIX}${id}`;
}

/** The blog.json id in a post's author entry, or null for a Notra author id. */
export function siteAuthorRefId(value: string): string | null {
  if (!value.startsWith(SITE_AUTHOR_REF_PREFIX)) {
    return null;
  }
  const id = value.slice(SITE_AUTHOR_REF_PREFIX.length);
  return SITE_AUTHOR_ID.test(id) ? id : null;
}
