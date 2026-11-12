import { SITE_BYTE_PRESERVING_GIT_ATTRIBUTE } from "../constants/source";

/**
 * Whether every rule only uses attributes that leave archived bytes unchanged.
 * Macros and quoted patterns are not parsed and count as unsafe.
 */
export function isByteSafeGitAttributes(content: string): boolean {
  return content.split("\n").every((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return true;
    }
    if (trimmed.startsWith("[attr]") || trimmed.startsWith('"')) {
      return false;
    }
    const [, ...attributes] = trimmed.split(/\s+/);
    return attributes.every((attribute) =>
      SITE_BYTE_PRESERVING_GIT_ATTRIBUTE.test(attribute)
    );
  });
}
