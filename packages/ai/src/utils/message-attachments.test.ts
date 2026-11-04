import { afterAll, beforeEach, expect, mock, spyOn, test } from "bun:test";

import type { UIMessage } from "ai";

const storage = "https://files.example.test";
let recordedKeys: string[] = [];
mock.module("@notra/db/drizzle", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => recordedKeys.map((key) => ({ key })),
      }),
    }),
  },
}));
const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((
  input: string | URL | Request
) =>
  Promise.resolve(
    new Response(null, {
      status: String(input).endsWith("/gone.png") ? 404 : 200,
    })
  )) as typeof fetch);
const originalPublicUrl = process.env.CLOUDFLARE_PUBLIC_URL;
process.env.CLOUDFLARE_PUBLIC_URL = `${storage}/`;
afterAll(() => {
  fetchSpy.mockRestore();
  process.env.CLOUDFLARE_PUBLIC_URL = originalPublicUrl;
});
beforeEach(() => {
  recordedKeys = [];
  fetchSpy.mockClear();
});

const { replaceMissingFileAttachments } = await import("./message-attachments");

function file(name: string, origin = storage) {
  return {
    type: "file" as const,
    url: `${origin}/organization/o/chat/${name}`,
    filename: name,
    mediaType: "image/png",
  };
}

function userMessage(parts: UIMessage["parts"]): UIMessage[] {
  return [{ id: "m1", role: "user", parts }];
}

test("replaces uploaded attachments whose object is gone", async () => {
  const kept = file("kept.png");
  const external = file("gone.png", "https://example.test");
  const text = { type: "text" as const, text: "Describe these" };

  const result = await replaceMissingFileAttachments(
    "o",
    userMessage([file("gone.png"), kept, external, text])
  );

  expect(result[0]?.parts).toEqual([
    { type: "text", text: '[Attachment "gone.png" is no longer available]' },
    kept,
    external,
    text,
  ]);
});

test("only checks storage for attachments without a recorded row", async () => {
  recordedKeys = ["organization/o/chat/a.png"];
  const messages = userMessage([file("a.png"), file("b.png")]);

  expect(await replaceMissingFileAttachments("o", messages)).toBe(messages);
  expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
    `${storage}/organization/o/chat/b.png`,
  ]);
});

test("makes no requests when every attachment is recorded", async () => {
  recordedKeys = ["organization/o/chat/a.png"];
  const messages = userMessage([file("a.png")]);

  expect(await replaceMissingFileAttachments("o", messages)).toBe(messages);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("keeps attachments when the storage check is cancelled", async () => {
  const controller = new AbortController();
  fetchSpy.mockImplementationOnce(
    ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason)
        );
        controller.abort();
      })) as typeof fetch
  );
  const messages = userMessage([file("gone.png")]);

  expect(
    await replaceMissingFileAttachments("o", messages, controller.signal)
  ).toBe(messages);
});
