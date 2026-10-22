import type { SITE_DESIGN_SECTIONS } from "@/constants/site-design-sections";
import type { SiteRawConfig } from "@/types/site-design";

export type SiteDesignSection = (typeof SITE_DESIGN_SECTIONS)[number]["id"];
export interface SiteDesignIssue {
  path: string;
  message: string;
}
export interface SiteConfigField {
  path: string;
  kind?:
    | "text"
    | "textarea"
    | "boolean"
    | "number"
    | "select"
    | "lines"
    | "choice-list"
    | "width"
    | "collection";
  options?: readonly (string | boolean)[];
  fallback?: unknown;
  fields?: readonly SiteConfigField[];
  record?: boolean;
  initial?: SiteRawConfig;
  optional?: boolean;
}
export interface SiteConfigFieldsProps {
  fields: readonly SiteConfigField[];
  config: SiteRawConfig;
  onChange: (config: SiteRawConfig) => void;
  prefix?: string;
}
export interface SiteConfigFieldProps {
  field: SiteConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  path: string;
}
export interface SiteDesignErrorProps {
  path?: string;
}

export interface SiteDesignAppearanceProps {
  section: string;
}
