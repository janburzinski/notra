import "@/workflows/runtime";
import type { GeoScopeInput } from "@notra/geo-core/types/geo";

import { fetchGeoShelfPagesForScope } from "@/lib/geo-shelf/fetch-pages";

export async function fetchGeoShelfPagesStep(
  input: GeoScopeInput
): Promise<number> {
  "use step";
  const summary = await fetchGeoShelfPagesForScope(input);
  return summary.read;
}
