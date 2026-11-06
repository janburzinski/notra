import { logError } from "@notra/ai/utils/server-log";
import { isDemoMode } from "@notra/utils/demo-mode";
import { ORPCError } from "@orpc/server";

import { CONTENT_MEDIA } from "@/constants/content-media";
import { DEMO_DISABLED_MESSAGE } from "@/constants/demo";
import { assertAuthenticated } from "@/lib/auth/organization";
import { uploadContentImage, uploadContentVideo } from "@/lib/upload/server";
import type { ContentMediaKind } from "@/types/content/media";
import {
  contentImageMaxBytes,
  contentImageTooLargeMessage,
  guessContentImageMime,
} from "@/utils/content-image-size";
import { readBoundedRequestBody } from "@/utils/read-bounded-request-body";

const CONTENT_UPLOADS = {
  image: uploadContentImage,
  video: uploadContentVideo,
} as const satisfies Record<
  ContentMediaKind,
  typeof uploadContentImage | typeof uploadContentVideo
>;

const MAX_CONTENT_MULTIPART_BYTES =
  Math.max(CONTENT_MEDIA.image.maxBytes, CONTENT_MEDIA.video.maxBytes) +
  16 * 1024;

function errorResponse(error: unknown, failed: string) {
  if (error instanceof ORPCError) {
    return Response.json({ message: error.message }, { status: error.status });
  }
  logError("Content upload failed", error);
  return Response.json({ message: failed }, { status: 500 });
}

function uploadKind(form: FormData): ContentMediaKind {
  return form.get("kind") === "video" ? "video" : "image";
}

export async function POST(request: Request) {
  if (isDemoMode()) {
    return Response.json({ message: DEMO_DISABLED_MESSAGE }, { status: 403 });
  }
  try {
    await assertAuthenticated({ headers: request.headers });
  } catch (error) {
    return errorResponse(error, CONTENT_MEDIA.image.failed);
  }
  if (
    Number(request.headers.get("content-length")) > MAX_CONTENT_MULTIPART_BYTES
  ) {
    return Response.json({ message: "Upload too large" }, { status: 413 });
  }
  let form: FormData;
  try {
    const body = await readBoundedRequestBody(
      request,
      MAX_CONTENT_MULTIPART_BYTES
    );
    if (!body) {
      return Response.json({ message: "Upload too large" }, { status: 413 });
    }
    const multipart = new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      body: body.buffer,
    });
    form = await multipart.formData();
  } catch {
    return Response.json(
      { message: CONTENT_MEDIA.image.choose },
      { status: 400 }
    );
  }

  const kind = uploadKind(form);
  const media = CONTENT_MEDIA[kind];
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: media.choose }, { status: 400 });
  }
  const imageMime = kind === "image" ? guessContentImageMime(file) : "";
  const maxBytes =
    kind === "image" ? contentImageMaxBytes(imageMime) : media.maxBytes;
  if (file.size > maxBytes) {
    return Response.json(
      {
        message:
          kind === "image"
            ? contentImageTooLargeMessage(imageMime)
            : media.tooLarge,
      },
      { status: 400 }
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await CONTENT_UPLOADS[kind]({
      bytes,
      headers: request.headers,
    });
    return Response.json(uploaded);
  } catch (error) {
    return errorResponse(error, media.failed);
  }
}
