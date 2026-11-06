import { expect, mock, test } from "bun:test";

import { ORPCError } from "@orpc/server";

import { CONTENT_MEDIA } from "@/constants/content-media";

const authenticate = mock(async () => {});
const uploadContentImage = mock(
  async (_input: { bytes: Uint8Array; headers: Headers }) => ({ success: true })
);
const uploadContentVideo = mock(
  async (_input: { bytes: Uint8Array; headers: Headers }) => ({ success: true })
);

mock.module("@/lib/auth/organization", () => ({
  assertAuthenticated: authenticate,
}));
mock.module("@/lib/upload/server", () => ({
  uploadContentImage,
  uploadContentVideo,
}));

const { POST } = await import("../src/app/api/uploads/content-image/route");
const maxMultipartBytes =
  Math.max(CONTENT_MEDIA.image.maxBytes, CONTENT_MEDIA.video.maxBytes) +
  16 * 1024;

function streamedRequest(length: number, declaredLength?: string) {
  let canceled = false;
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        controller.enqueue(new Uint8Array(length));
        sent = true;
      }
    },
    cancel() {
      canceled = true;
    },
  });
  const request = new Request("http://localhost/api/uploads/content-image", {
    method: "POST",
    headers: declaredLength ? { "Content-Length": declaredLength } : {},
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, wasCanceled: () => canceled };
}

test("authenticates before reading the multipart stream", async () => {
  authenticate.mockImplementationOnce(async () => {
    throw new ORPCError("UNAUTHORIZED");
  });
  const { request, wasCanceled } = streamedRequest(maxMultipartBytes + 1);
  expect((await POST(request)).status).toBe(401);
  expect(wasCanceled()).toBe(false);
  expect(uploadContentImage).not.toHaveBeenCalled();
  expect(uploadContentVideo).not.toHaveBeenCalled();
});

test.each([undefined, "bad", "10"])(
  "rejects an oversized streamed multipart body despite Content-Length %p",
  async (declaredLength) => {
    const { request, wasCanceled } = streamedRequest(
      maxMultipartBytes + 1,
      declaredLength
    );
    expect((await POST(request)).status).toBe(413);
    expect(wasCanceled()).toBe(true);
    expect(uploadContentImage).not.toHaveBeenCalled();
    expect(uploadContentVideo).not.toHaveBeenCalled();
  }
);

test("rejects an oversized declared length before consuming the stream", async () => {
  const { request, wasCanceled } = streamedRequest(
    100,
    String(maxMultipartBytes + 1)
  );
  expect((await POST(request)).status).toBe(413);
  expect(wasCanceled()).toBe(false);
});

test.each(["image", "video"] as const)(
  "uploads a valid %s multipart file without changing its bytes",
  async (kind) => {
    const bytes = new Uint8Array([0, 1, 127, 255]);
    const form = new FormData();
    form.set("kind", kind);
    form.set(
      "file",
      new File([bytes], `${kind}.bin`, { type: "application/octet-stream" })
    );
    const request = new Request("http://localhost/api/uploads/content-image", {
      method: "POST",
      body: form,
    });
    const upload = kind === "image" ? uploadContentImage : uploadContentVideo;
    upload.mockClear();

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]?.[0].bytes).toEqual(bytes);
  }
);
