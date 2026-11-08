import type { syncGeneratedCoverImage as syncCover } from "@notra/ai/utils/post-cover-image";
import { logWarn } from "@notra/ai/utils/server-log";

/**
 * Cover rendering loads the native sharp module, which the agent build cannot
 * evaluate, so callers on the agent's import path load it only when needed.
 * Never throws, like the function it loads: a failed load skips the cover.
 */
export async function syncGeneratedCoverImage(
  params: Parameters<typeof syncCover>[0]
): Promise<void> {
  let sync: typeof syncCover;
  try {
    ({ syncGeneratedCoverImage: sync } =
      await import("@notra/ai/utils/post-cover-image"));
  } catch (error) {
    logWarn("[post-cover] Could not load cover rendering", {
      postId: params.postId,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  await sync(params);
}
