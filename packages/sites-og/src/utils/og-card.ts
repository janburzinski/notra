import type { SiteConfig } from "@notra/sites-core/types/site-config";
import type { ReactElement } from "react";

import { OgArticleCard } from "../components/og-article-card";
import { OgAuthorCard } from "../components/og-author-card";
import { OgCard } from "../components/og-card";
import {
  OG_CUSTOM_FONT_NAME,
  OG_FONT_FAMILY,
  OG_LONG_DATE,
  OG_SHORT_DATE,
  OG_SHORT_DATE_WITH_YEAR,
} from "../constants/og-images";
import type {
  OgAreaCardInput,
  OgAuthor,
  OgCardStyle,
  OgEntryCardInput,
} from "../types/og-images";

/** The font list of a card: the site's thumbnail font first, Inter for the rest. */
export function ogFontFamily(custom: boolean): string {
  return custom
    ? `"${OG_CUSTOM_FONT_NAME}", ${OG_FONT_FAMILY}`
    : OG_FONT_FAMILY;
}

/** The logo cards show: the light logo, else the light favicon. */
export function ogLogoPath(config: SiteConfig): string | undefined {
  const { logo, favicon } = config;
  const path = typeof logo === "string" ? logo : logo?.light;
  return path ?? (typeof favicon === "string" ? favicon : favicon?.light);
}

/** The brand color on the card's background: the dark-mode accent on dark cards. */
export function ogAccent(config: SiteConfig): string {
  return config.thumbnails.appearance === "dark"
    ? (config.colors.light ?? config.colors.primary)
    : config.colors.primary;
}

export function ogDomain(publicOrigin: string): string {
  return new URL(publicOrigin).hostname.replace(/^www\./, "");
}

function withSiteName(siteName: string, title: string): string {
  return title.startsWith(siteName) ? title : `${siteName} · ${title}`;
}

function formatShortDate(date: Date, now: Date): string {
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return (sameYear ? OG_SHORT_DATE : OG_SHORT_DATE_WITH_YEAR).format(date);
}

/** The author layout shows the logo for an author without an avatar. */
function authorWithFallback(
  author: OgAuthor | undefined,
  logo: string | undefined
): OgAuthor | undefined {
  return author && !author.avatar && logo
    ? { ...author, avatar: logo }
    : author;
}

/** The share image of a post or changelog entry in the site's layout. */
export function ogEntryCard({
  config,
  areaTitle,
  entry,
  style,
  now,
}: OgEntryCardInput): ReactElement {
  const { layout, label } = config.thumbnails;
  if (layout === "article") {
    return OgArticleCard({
      ...style,
      date: formatShortDate(entry.date, now),
      category: entry.tags[0] ?? label ?? areaTitle,
      title: entry.title,
      description: entry.description,
      authors: entry.authors,
    });
  }
  if (layout === "author") {
    return OgAuthorCard({
      ...style,
      label: label ?? areaTitle,
      title: entry.title,
      author: authorWithFallback(entry.authors[0], style.logo),
    });
  }
  return OgCard({
    ...style,
    eyebrow: withSiteName(config.name, areaTitle),
    title: entry.title,
    footer: [entry.version, OG_LONG_DATE.format(entry.date)]
      .filter(Boolean)
      .join(" · "),
  });
}

/** The share image of a section's home page, also used by its tag and author pages. */
export function ogAreaCard({
  config,
  title,
  section,
  description,
  style,
}: OgAreaCardInput): ReactElement {
  const { layout, label } = config.thumbnails;
  const category = label ?? section;
  if (layout === "article") {
    return OgArticleCard({
      ...style,
      date: config.name,
      category: category === title ? "" : category,
      title,
      description,
      authors: [],
    });
  }
  if (layout === "author") {
    return OgAuthorCard({ ...style, label: category, title });
  }
  return OgCard({
    ...style,
    eyebrow: config.name,
    title,
    footer: style.domain,
  });
}

export function ogStyle(
  config: SiteConfig,
  assets: Pick<OgCardStyle, "logo" | "background" | "domain"> & {
    customFont: boolean;
  }
): OgCardStyle {
  return {
    appearance: config.thumbnails.appearance,
    accent: ogAccent(config),
    logo: assets.logo,
    domain: assets.domain,
    background: assets.background,
    fontFamily: ogFontFamily(assets.customFont),
  };
}
