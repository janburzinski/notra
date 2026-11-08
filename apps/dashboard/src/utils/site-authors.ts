import {
  CONTENT_AUTHOR_NAME_MAX_LENGTH,
  CONTENT_AUTHOR_TITLE_MAX_LENGTH,
  SITE_AUTHOR_BIO_MAX_LENGTH,
} from "@notra/schemas/constants/dashboard/post-metadata";
import type { ContentAuthor } from "@notra/schemas/shared/post-metadata";
import { siteAuthorLinkSchema } from "@notra/schemas/shared/site-authors";
import {
  SITE_AUTHOR_AVATAR,
  SITE_AUTHOR_ID,
} from "@notra/sites-core/constants/site-config";
import { siteAuthorRef } from "@notra/sites-core/utils/site-author-refs";

import { CONTENT_AUTHOR_LINK_FIELDS } from "@/constants/content-overview";
import { SITE_AUTHOR_FIELDS, TRAILING_SLASHES } from "@/constants/site-authors";
import type {
  SiteAuthor,
  SiteAuthorEntry,
  SiteAuthorForm,
  SiteAuthorFormErrors,
  SiteAuthorImport,
  SiteAuthorPageLayout,
} from "@/types/site-authors";
import type { SiteRawConfig } from "@/types/site-design";
import { authorSlugBase } from "@/utils/content-authors";
import { configValue, patchConfigValue } from "@/utils/site-design-sections";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The authors in blog.json, in file order. Entries without a name are skipped. */
export function readSiteAuthors(config: SiteRawConfig): SiteAuthorEntry[] {
  if (!isRecord(config.authors)) {
    return [];
  }
  return Object.entries(config.authors).flatMap(([id, value]) => {
    if (!(isRecord(value) && typeof value.name === "string")) {
      return [];
    }
    const author: SiteAuthor = { name: value.name };
    for (const field of SITE_AUTHOR_FIELDS) {
      const text = value[field];
      if (typeof text === "string") {
        author[field] = text;
      }
    }
    return [{ id, author }];
  });
}

export function siteAuthorForm(entry: SiteAuthorEntry | null): SiteAuthorForm {
  const form = { id: entry?.id ?? "" } as SiteAuthorForm;
  for (const field of SITE_AUTHOR_FIELDS) {
    form[field] = entry?.author[field] ?? "";
  }
  return form;
}

export function siteAuthorFromForm(form: SiteAuthorForm): SiteAuthorEntry {
  const author: SiteAuthor = { name: form.name.trim() };
  for (const field of SITE_AUTHOR_FIELDS) {
    const value = form[field].trim();
    if (value) {
      author[field] = value;
    }
  }
  return { id: form.id.trim(), author };
}

export function validateSiteAuthorForm(
  form: SiteAuthorForm,
  takenIds: ReadonlySet<string>
): SiteAuthorFormErrors {
  const errors: SiteAuthorFormErrors = {};
  const id = form.id.trim();
  if (!id) {
    errors.id = "required";
  } else if (!SITE_AUTHOR_ID.test(id)) {
    errors.id = "idFormat";
  } else if (takenIds.has(id)) {
    errors.id = "idTaken";
  }
  const name = form.name.trim();
  if (!name) {
    errors.name = "required";
  } else if (name.length > CONTENT_AUTHOR_NAME_MAX_LENGTH) {
    errors.name = "tooLong";
  }
  if (form.title.trim().length > CONTENT_AUTHOR_TITLE_MAX_LENGTH) {
    errors.title = "tooLong";
  }
  if (form.bio.trim().length > SITE_AUTHOR_BIO_MAX_LENGTH) {
    errors.bio = "tooLong";
  }
  const avatar = form.avatar.trim();
  if (avatar && !SITE_AUTHOR_AVATAR.test(avatar)) {
    errors.avatar = "avatar";
  }
  for (const field of CONTENT_AUTHOR_LINK_FIELDS) {
    const value = form[field].trim();
    if (value && !siteAuthorLinkSchema.safeParse(value).success) {
      errors[field] = "https";
    }
  }
  return errors;
}

/** Adds or replaces an author, keeping its place in blog.json when renamed. */
export function writeSiteAuthor(
  config: SiteRawConfig,
  previousId: string | null,
  entry: SiteAuthorEntry
): SiteRawConfig {
  const current = isRecord(config.authors) ? config.authors : {};
  const authors: Record<string, unknown> = {};
  let placed = false;
  for (const [id, value] of Object.entries(current)) {
    if (id === previousId || id === entry.id) {
      if (!placed) {
        authors[entry.id] = entry.author;
        placed = true;
      }
      continue;
    }
    authors[id] = value;
  }
  if (!placed) {
    authors[entry.id] = entry.author;
  }
  return { ...structuredClone(config), authors };
}

export function removeSiteAuthor(
  config: SiteRawConfig,
  id: string
): SiteRawConfig {
  const next = structuredClone(config);
  if (isRecord(next.authors)) {
    delete next.authors[id];
  }
  return next;
}

/** Where author pages live under the blog, such as /blog/author. */
export function siteAuthorPagesPath(blogMount: string): string {
  return `${blogMount.replace(TRAILING_SLASHES, "")}/author`;
}

/** The live author page, such as https://acme.com/blog/author/jan. */
export function siteAuthorPageUrl(
  publicOrigin: string,
  blogMount: string,
  id: string
): string {
  return `${publicOrigin.replace(TRAILING_SLASHES, "")}${siteAuthorPagesPath(blogMount)}/${id}`;
}

export function siteAuthorPageLayout(
  config: SiteRawConfig
): SiteAuthorPageLayout {
  return configValue(config, "blog.authorPage") === "stacked"
    ? "stacked"
    : "inline";
}

/** `inline` is the default, so it's only written when blog.json already sets it. */
export function setSiteAuthorPageLayout(
  config: SiteRawConfig,
  published: SiteRawConfig,
  layout: SiteAuthorPageLayout
): SiteRawConfig {
  const explicit = configValue(published, "blog.authorPage") !== undefined;
  return patchConfigValue(
    config,
    "blog.authorPage",
    layout === "inline" && !explicit ? undefined : layout
  );
}

function shorten(text: string | null, max: number): string | undefined {
  const value = text?.trim();
  if (!value) {
    return undefined;
  }
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * Notra authors as blog.json entries, matched by their slug. Avatars on a
 * public https URL are kept; uploads only the dashboard can read are copied
 * into the site before they're used.
 */
export function siteAuthorImports(
  authors: ContentAuthor[],
  siteIds: ReadonlySet<string>
): SiteAuthorImport[] {
  return authors.map((row) => {
    const id = SITE_AUTHOR_ID.test(row.slug)
      ? row.slug
      : authorSlugBase(row.name);
    const author: SiteAuthor = {
      name:
        shorten(row.name, CONTENT_AUTHOR_NAME_MAX_LENGTH) ?? row.name.trim(),
    };
    const title = shorten(row.title, CONTENT_AUTHOR_TITLE_MAX_LENGTH);
    if (title) {
      author.title = title;
    }
    const avatar = row.avatarUrl?.trim() ?? "";
    if (avatar.startsWith("https://")) {
      author.avatar = avatar;
    }
    const bio = shorten(row.bio, SITE_AUTHOR_BIO_MAX_LENGTH);
    if (bio) {
      author.bio = bio;
    }
    for (const field of CONTENT_AUTHOR_LINK_FIELDS) {
      const value = row[field]?.trim();
      if (value) {
        author[field] = value;
      }
    }
    return {
      id,
      author,
      avatarUpload: avatar.startsWith("/api/uploads/") ? avatar : null,
      exists: siteIds.has(id),
    };
  });
}

/**
 * The picker's selection for a Sites post. Notra authors whose slug is an id
 * in blog.json show as that site author, so the next change stores the site
 * id; any other Notra author stays selected as it is.
 */
export function siteAuthorSelection(
  authorIds: string[],
  contentAuthors: ContentAuthor[],
  siteIds: ReadonlySet<string>
): string[] {
  const byId = new Map(contentAuthors.map((author) => [author.id, author]));
  const selected = authorIds.map((value) => {
    const slug = byId.get(value)?.slug;
    return slug && siteIds.has(slug) ? siteAuthorRef(slug) : value;
  });
  return [...new Set(selected)];
}
