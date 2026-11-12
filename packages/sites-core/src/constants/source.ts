import { SITE_SOURCE_EXTENSIONS } from "./sites";

export const SITE_IGNORE_FILENAME = ".notraignore";
export const SITE_IGNORE_MAX_BYTES = 512 * 1024;

export const SITE_GIT_ATTRIBUTES_FILENAME = ".gitattributes";
export const SITE_GIT_ATTRIBUTES_MAX_BYTES = 64 * 1024;
export const SITE_GIT_ATTRIBUTES_MAX_FILES = 8;
/**
 * Attributes that never change the bytes in a GitHub archive: GitHub metadata,
 * disabled text conversion, and diff/merge drivers.
 */
export const SITE_BYTE_PRESERVING_GIT_ATTRIBUTE =
  /^(?:[-!]?linguist-[\w-]+(?:=\S+)?|binary|[-!]text|[-!]?(?:diff|merge)(?:=\S+)?)$/;

export const SITE_SOURCE_ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(
  SITE_SOURCE_EXTENSIONS
);
export const SITE_SOURCE_SAFE_SEGMENT = /^[A-Za-z0-9._@()+ -]+$/;
