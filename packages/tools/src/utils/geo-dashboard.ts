import { GEO_PROMPT_SCAN_TIMEOUT_MS } from "@notra/ai/constants/geo-tools";
import { getBaseUrl } from "@notra/ai/qstash/triggers";
import { geoPromptScanErrorSchema } from "@notra/geo-core/schemas/geo-prompt-scan";
import type { z } from "zod";

import {
  GEO_PROMPT_SCAN_FAILED_MESSAGE,
  GEO_PROMPT_SCAN_NOT_CONFIGURED_MESSAGE,
} from "../constants/analytics";

/**
 * Posts to one of the dashboard's internal GEO routes for the agent, which
 * runs in its own deployment. Returns the parsed body, or the message to hand
 * the model when the dashboard turned the request down or can't be reached.
 */
export async function callDashboardGeoRoute<Schema extends z.ZodType>(
  path: string,
  body: unknown,
  responseSchema: Schema
): Promise<z.output<Schema> | string> {
  const baseUrl = getBaseUrl();
  const secret = process.env.INTERNAL_WORKFLOW_SECRET?.trim();
  if (!(baseUrl && secret)) {
    return GEO_PROMPT_SCAN_NOT_CONFIGURED_MESSAGE;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GEO_PROMPT_SCAN_TIMEOUT_MS),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = geoPromptScanErrorSchema.safeParse(json);
    return error.success ? error.data.error : GEO_PROMPT_SCAN_FAILED_MESSAGE;
  }
  return responseSchema.parse(json);
}
