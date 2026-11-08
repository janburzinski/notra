import { WEB_ANALYTICS_UNAVAILABLE_MESSAGE } from "@notra/ai/constants/web-analytics-access";
import type { Context, Next } from "hono";

import type { ApiEnv } from "../types/env";
import { isWebAnalyticsEnabledForRequest } from "../utils/web-analytics";

/** Web analytics endpoints answer 403 until the workspace has the flag. */
export function webAnalyticsMiddleware() {
  return async (c: Context<ApiEnv>, next: Next) => {
    if (!(await isWebAnalyticsEnabledForRequest(c))) {
      return c.json({ error: WEB_ANALYTICS_UNAVAILABLE_MESSAGE }, 403);
    }
    await next();
  };
}
