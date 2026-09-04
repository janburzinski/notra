import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { GITHUB_CONNECTION_REQUIRED_MESSAGE } from "@/lib/star-video/github-cookies";
import { readGithubToken } from "@/lib/star-video/github-oauth";
import {
  enforceGlobalRenderLimit,
  enforceStarVideoRateLimit,
} from "@/lib/star-video/ratelimit";
import { renderPrMergeVideo } from "@/lib/star-video/render";
import { prMergeVideoInputSchema } from "@/schemas/pr-merge-video";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!readGithubToken(request)) {
    return NextResponse.json(
      { error: GITHUB_CONNECTION_REQUIRED_MESSAGE },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const parsed = prMergeVideoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const filename = `${parsed.data.owner}-${parsed.data.repo}-pr-merges.mp4`;

  return Effect.runPromise(
    Effect.gen(function* () {
      yield* enforceStarVideoRateLimit(request, "render");
      yield* enforceGlobalRenderLimit();

      const video = yield* Effect.tryPromise({
        try: () => renderPrMergeVideo(parsed.data),
        catch: (cause) =>
          cause instanceof Error ? cause : new Error("Failed to render video"),
      });

      return new NextResponse(new Uint8Array(video), {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }).pipe(
      Effect.match({
        onFailure: (error) => {
          if (
            "_tag" in error &&
            (error._tag === "StarVideoRateLimitExceeded" ||
              error._tag === "RenderBusy")
          ) {
            return NextResponse.json(
              { error: "Too many render requests. Please try again shortly." },
              { status: 429 }
            );
          }
          console.error("Failed to render PR merge video", error);
          return NextResponse.json(
            { error: "Failed to render the video. Please try again." },
            { status: 500 }
          );
        },
        onSuccess: (response) => response,
      })
    )
  );
}
