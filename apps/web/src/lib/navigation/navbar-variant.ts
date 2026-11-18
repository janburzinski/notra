import { LANDING_HOME_PATHS } from "@/constants/i18n";
import type { NavbarVariant } from "@/types/navbar";

const ANNOUNCEMENT_PATHS = new Set([
  LANDING_HOME_PATHS.en,
  LANDING_HOME_PATHS.de,
  "/landing",
]);

export function getNavbarVariantForPath(pathname: string): NavbarVariant {
  if (ANNOUNCEMENT_PATHS.has(pathname)) {
    return "announcement";
  }
  return "landing";
}
