import { GEO_PROMPT_SCAN_INTERNAL_PATH } from "@notra/ai/constants/geo-tools";
import { scanGeoPromptInputSchema } from "@notra/ai/schemas/geo-tools";
import { logError } from "@notra/ai/utils/server-log";
import {
  geoPromptScanRequestSchema,
  geoPromptScanResponseSchema,
} from "@notra/geo-core/schemas/geo-prompt-scan";
import { defineTool } from "eve/tools";

import {
  GEO_PROMPT_SCAN_FAILED_MESSAGE,
  GEO_PROMPT_SCAN_TASK_DENIED_MESSAGE,
} from "../constants/analytics";
import { callDashboardGeoRoute } from "../utils/geo-dashboard";
import { requireOrganizationId } from "../utils/organization";
import { getSessionAttribute } from "../utils/session";

export function createScanGeoPromptTool() {
  return defineTool({
    description:
      "Ask AI engines one tracked GEO prompt again now, on every engine the project tracks or only the engines in engines (one is fine), for example to check whether ChatGPT mentions the brand today. The user approves each call because it uses AI answers, so first find the exact prompt with find_geo_prompts and pass its id; when the request fits several prompts, ask which one before calling. Returns status started with a scanId; call get_geo_scan with it after a minute or two (consumer apps such as ChatGPT can take several minutes). status choose or not_found lists prompts to pick from: ask the user, never guess. An unknown engine id returns the ids this project can scan.",
    inputSchema: scanGeoPromptInputSchema,
    approval: {
      request: (ctx) =>
        getSessionAttribute(ctx, "surface") === "task"
          ? { type: "denied", reason: GEO_PROMPT_SCAN_TASK_DENIED_MESSAGE }
          : "user-approval",
      // Approval cards are collaborative: anyone who sees one may answer it.
      response: () => ({ status: "allowed" }),
    },
    async execute({ projectId, prompt, engines }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return await callDashboardGeoRoute(
          GEO_PROMPT_SCAN_INTERNAL_PATH,
          geoPromptScanRequestSchema.parse({
            organizationId,
            projectId,
            prompt,
            engines,
          }),
          geoPromptScanResponseSchema
        );
      } catch (error) {
        logError("Scan GEO prompt tool failed", error, { organizationId });
        return GEO_PROMPT_SCAN_FAILED_MESSAGE;
      }
    },
  });
}
