import { consumeChatGenerationRateLimit } from "@notra/ai/utils/chat-generation-rate-limit";
import { getRateLimitHeaders } from "@notra/utils/ratelimit";

export async function enforceChatGenerationRatelimit(
  organizationId: string,
  userId: string
): Promise<Response | null> {
  const result = await consumeChatGenerationRateLimit(organizationId, userId);
  if (result.success) {
    return null;
  }

  return Response.json(
    {
      error: "Rate limit exceeded",
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    },
    { status: 429, headers: getRateLimitHeaders(result, true) }
  );
}
