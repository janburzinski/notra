import type { NavbarVariant } from "@/types/navbar";

const ANNOUNCEMENT_PATHS = new Set(["/", "/home", "/landing"]);

export function getNavbarVariantForPath(pathname: string): NavbarVariant {
  if (ANNOUNCEMENT_PATHS.has(pathname)) {
    return "announcement";
  }
  return "landing";
}
