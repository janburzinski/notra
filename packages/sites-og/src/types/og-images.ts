import type { SiteConfig } from "@notra/sites-core/types/site-config";
import type satori from "satori";

type OgAppearance = "light" | "dark";

/** What every card of a site shares. */
export interface OgCardStyle {
  appearance: OgAppearance;
  accent: string;
  logo?: string;
  domain: string;
  background?: string;
  /** CSS font family list; Inter when unset. */
  fontFamily?: string;
}

export interface OgCardContent {
  eyebrow: string;
  title: string;
  footer: string;
  appearance: OgAppearance;
  accent: string;
  background?: string;
  fontFamily?: string;
}

export interface OgAuthor {
  name: string;
  title?: string;
  avatar?: string;
}

export interface OgAuthorCardContent {
  label: string;
  title: string;
  domain: string;
  appearance: OgAppearance;
  logo?: string;
  author?: OgAuthor;
  background?: string;
  fontFamily?: string;
}

export interface OgArticleCardContent {
  date: string;
  category: string;
  title: string;
  description?: string;
  domain: string;
  appearance: OgAppearance;
  accent: string;
  logo?: string;
  authors: OgAuthor[];
  background?: string;
  fontFamily?: string;
}

export type SatoriFont = Parameters<typeof satori>[1]["fonts"][number];

/** A post or changelog entry, as its share image shows it. */
export interface OgEntry {
  title: string;
  description?: string;
  date: Date;
  version?: string;
  tags: readonly string[];
  authors: OgAuthor[];
}

export interface OgEntryCardInput {
  config: SiteConfig;
  /** The section's configured title, like "Engineering blog". */
  areaTitle: string;
  entry: OgEntry;
  style: OgCardStyle;
  now: Date;
}

export interface OgAreaCardInput {
  config: SiteConfig;
  /** The section's configured title, like "Engineering blog". */
  title: string;
  /** The section's plain name, like "Blog". */
  section: string;
  description?: string;
  style: OgCardStyle;
}
