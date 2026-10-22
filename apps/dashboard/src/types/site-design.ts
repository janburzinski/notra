import type { SITE_NAVBAR_LINK_TYPES } from "@notra/sites-core/constants/site-layout";
import type { ReactNode } from "react";

import type {
  SITE_APPEARANCE_MODES,
  SITE_BACKGROUND_DECORATIONS,
  SITE_CODE_THEME_MODES,
  SITE_FONT_FORMATS,
  SITE_FONT_WEIGHTS,
  SITE_TYPOGRAPHY_MODES,
} from "@/constants/site-design";

export type SiteAppearanceMode = (typeof SITE_APPEARANCE_MODES)[number];
export type SiteBackgroundDecoration =
  (typeof SITE_BACKGROUND_DECORATIONS)[number];
export type SiteCodeThemeMode = (typeof SITE_CODE_THEME_MODES)[number];
export type SiteFontWeight = (typeof SITE_FONT_WEIGHTS)[number];
export type SiteFontFormat = (typeof SITE_FONT_FORMATS)[number];
export type SiteTypographyMode = (typeof SITE_TYPOGRAPHY_MODES)[number];
export type SiteNavbarButton =
  | "none"
  | "button"
  | (typeof SITE_NAVBAR_LINK_TYPES)[number];

/** blog.json as written in the repository, before schema defaults. */
export type SiteRawConfig = Record<string, unknown>;

export interface SiteFontSpecForm {
  /** Empty keeps the theme default. Not in the preset list means custom. */
  family: string;
  /** Empty string keeps the theme default. */
  weight: string;
  /** Self-hosted file; empty loads the family from Google Fonts. */
  source: string;
  format: SiteFontFormat | "";
}

export interface SiteNavbarLinkForm {
  id: string;
  label: string;
  href: string;
}

export interface SiteDesignForm {
  name: string;
  description: string;
  separateLogos: boolean;
  logoLight: string;
  logoDark: string;
  logoHref: string;
  separateFavicons: boolean;
  faviconLight: string;
  faviconDark: string;
  primary: string;
  darkModeAccent: string;
  button: string;
  backgroundLight: string;
  backgroundDark: string;
  separateBackgroundImages: boolean;
  backgroundImageLight: string;
  backgroundImageDark: string;
  decoration: SiteBackgroundDecoration;
  appearance: SiteAppearanceMode;
  showModeToggle: boolean;
  codeMode: SiteCodeThemeMode;
  codeLight: string;
  codeDark: string;
  typographyMode: SiteTypographyMode;
  font: SiteFontSpecForm;
  heading: SiteFontSpecForm;
  body: SiteFontSpecForm;
  navbarButton: SiteNavbarButton;
  navbarButtonLabel: string;
  navbarButtonHref: string;
  navbarLinks: SiteNavbarLinkForm[];
}

type SiteDesignFormUpdate<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export interface SiteColorInputProps {
  id: string;
  /** Accessible name of the hex field and the picker. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Color the field falls back to while empty, shown in the swatch. */
  fallback?: string;
}

export interface SiteFontRowsProps {
  id: string;
  label: string;
  hint: string;
  weightLabel: string;
  weightHint: string;
  /** Hide the weight until a family is picked; blog.json needs both. */
  weightNeedsFamily?: boolean;
  value: SiteFontSpecForm;
  onChange: (value: SiteFontSpecForm) => void;
}

export interface SiteSeparateAssetRowsProps {
  id: string;
  title: string;
  description: string;
  separateLabel: string;
  separate: boolean;
  onSeparateChange: (separate: boolean) => void;
  light: string;
  dark: string;
  onLightChange: (value: string) => void;
  onDarkChange: (value: string) => void;
  placeholder: string;
}

export interface SiteAssetFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export interface SiteBrandDefaults {
  primary?: string;
  logoLight?: string;
  logoDark?: string;
  headingFamily?: string;
  bodyFamily?: string;
}

export interface SiteDesignFieldsProps<T> {
  form: T;
  update: SiteDesignFormUpdate<T>;
}

export interface SiteOptionSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  /** Skeleton of an option, shown beside the open list for the highlighted one. */
  preview?: (value: T) => ReactNode;
  /** One-line explanation under the preview. */
  describe?: (value: T) => string;
}

export type SiteBrandField =
  | "primary"
  | "logoLight"
  | "logoDark"
  | "heading"
  | "body";

export interface SiteBrandChange {
  field: SiteBrandField;
  kind: "color" | "image" | "font";
  from: string;
  to: string;
}

export interface SiteBrandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: SiteBrandChange[];
  onConfirm: () => void;
}

export interface SiteBrandValueProps {
  change: SiteBrandChange;
  value: string;
}

export interface SiteDesignPreviewColors {
  primary: string;
  backgroundLight: string;
  backgroundDark: string;
}

export interface SiteMiniPageProps {
  colors: SiteDesignPreviewColors;
  tone: SiteDesignPreviewTone;
  decoration?: SiteBackgroundDecoration;
  code?: SiteDesignPreviewTone | "accent";
  className?: string;
}

export type SiteDesignPreviewTone = "light" | "dark";
