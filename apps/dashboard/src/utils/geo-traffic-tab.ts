import type { GeoTrafficTab } from "@/types/geo-traffic-pages";

/** The analytics tab a `/geo/traffic/{-$tab}` segment names, or null for an unknown one. */
export function geoTrafficTab(
  segment: string | undefined
): GeoTrafficTab | null {
  if (!segment) {
    return "agents";
  }
  return segment === "web" || segment === "mcp" ? segment : null;
}
