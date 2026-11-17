import { getGeoScanInputSchema } from "@notra/ai/schemas/geo-tools";
import { loadGeoScanForTool } from "@notra/ai/utils/geo-tool-data";
import { logError } from "@notra/ai/utils/server-log";
import { defineTool } from "eve/tools";

import {
  GEO_QUERY_FAILED_MESSAGE,
  GEO_SCAN_NOT_FOUND_MESSAGE,
} from "../constants/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createGetGeoScanTool() {
  return defineTool({
    description:
      "Read a GEO scan by scanId, for example the one scan_geo_prompt started. Returns status (running, completed or failed), the engines it asked, and each answer stored so far: prompt, engine, language, whether the brand was mentioned, its rank, competitors named and an excerpt, a page at a time: when has_more is true, call again with offset set to next_offset before drawing conclusions. While status is running, answers may still be missing; check again later instead of reporting them as not mentioned.",
    inputSchema: getGeoScanInputSchema,
    async execute({ scanId, offset }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return (
          (await loadGeoScanForTool(organizationId, scanId, offset)) ??
          GEO_SCAN_NOT_FOUND_MESSAGE
        );
      } catch (error) {
        logError("Get GEO scan tool failed", error, {
          organizationId,
          scanId,
        });
        return GEO_QUERY_FAILED_MESSAGE;
      }
    },
  });
}
