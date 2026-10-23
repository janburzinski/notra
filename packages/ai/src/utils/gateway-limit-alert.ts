import { GATEWAY_LIMIT_ALERT } from "@notra/ai/constants/evlog";
import {
  GATEWAY_FALLBACK_ORDER,
  HTTP_PAYMENT_REQUIRED,
  HTTP_TOO_MANY_REQUESTS,
} from "@notra/ai/constants/router";
import type { WideEvent } from "evlog";

/** Share the operational Slack webhook, with one alert per gateway/status/window. */
export async function alertGatewayLimit(event: WideEvent): Promise<void> {
  const webhook = process.env.GEO_SCAN_ALERT_WEBHOOK_URL;
  if (
    !webhook ||
    !GATEWAY_FALLBACK_ORDER.some((gateway) => gateway === event.gateway) ||
    (event.status !== HTTP_PAYMENT_REQUIRED &&
      event.status !== HTTP_TOO_MANY_REQUESTS)
  ) {
    return;
  }
  const { redis } = await import("@notra/ai/utils/redis");
  if (!redis) {
    return;
  }
  const environment =
    process.env.VERCEL_ENV ??
    process.env.RAILWAY_ENVIRONMENT_NAME ??
    process.env.NODE_ENV ??
    "unknown";
  const key = `ai:gateway-limit-alert:${environment}:${event.gateway}:${event.status}`;
  const claimed = await redis.set(key, "sent", {
    nx: true,
    ex: GATEWAY_LIMIT_ALERT.dedupeSeconds,
  });
  if (!claimed) {
    return;
  }
  try {
    const text = [
      "AI gateway limit hit",
      `Environment: ${environment}`,
      `Gateway: ${event.gateway}`,
      `HTTP status: ${event.status}`,
      `Model: ${event.model}`,
      `Call: ${event.callId}`,
      ...(event.organizationId
        ? [`Organization: ${event.organizationId}`]
        : []),
      ...(event.projectId ? [`Project: ${event.projectId}`] : []),
      "Fallback may still succeed. Further alerts for this gateway/status are muted for 5 minutes.",
    ].join("\n");
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "AI gateway limit hit",
        blocks: [{ type: "section", text: { type: "plain_text", text } }],
      }),
      signal: AbortSignal.timeout(GATEWAY_LIMIT_ALERT.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Slack alert returned HTTP ${response.status}`);
    }
  } catch (error) {
    await redis.del(key);
    throw error;
  }
}
