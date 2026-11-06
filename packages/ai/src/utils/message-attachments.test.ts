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

const { prepareChatFileAttachments, replaceMissingFileAttachments } =
  await import("./message-attachments");

function file(name: string, origin = storage, mediaType = "image/png") {
  return {
    type: "file" as const,
    url: `${origin}/organization/o/chat/${name}`,
    filename: name,
    mediaType,
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

test("keeps images, inlines uploaded text files and replaces other files with a note", async () => {
  fetchSpy.mockImplementation(((input: string | URL | Request) =>
    Promise.resolve(
      String(input).endsWith("/notes.md")
        ? new Response("# Launch notes")
        : new Response(null, { status: 404 })
    )) as typeof fetch);
  const text = { type: "text" as const, text: "Summarize these" };

  const image = file("diagram.png");
  const result = await prepareChatFileAttachments(
    userMessage([
      file("notes.md", storage, "text/markdown"),
      file("gone.txt", storage, "text/plain"),
      file("remote.txt", "https://example.test", "text/plain"),
      file("brief.pdf", storage, "application/pdf"),
      image,
      text,
    ])
  );

  expect(result[0]?.parts).toEqual([
    { type: "text", text: 'Attachment "notes.md":\n\n# Launch notes' },
    { type: "text", text: '[Attachment "gone.txt" could not be read]' },
    {
      type: "text",
      text: '[Attachment "remote.txt" (text/plain) was not sent: this chat can only read images, text and Markdown files]',
    },
    {
      type: "text",
      text: '[Attachment "brief.pdf" (application/pdf) was not sent: this chat can only read images, text and Markdown files]',
    },
    image,
    text,
  ]);
  expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([
    `${storage}/organization/o/chat/notes.md`,
    `${storage}/organization/o/chat/gone.txt`,
  ]);
});

test("truncates long text files and spends the text budget newest message first", async () => {
  fetchSpy.mockImplementation((() =>
    Promise.resolve(new Response("x".repeat(150_000)))) as typeof fetch);
  const messages: UIMessage[] = [
    {
      id: "old",
      role: "user",
      parts: [file("old.txt", storage, "text/plain")],
    },
    {
      id: "new",
      role: "user",
      parts: ["a", "b", "c"].map((name) =>
        file(`${name}.txt`, storage, "text/plain")
      ),
    },
  ];

  const result = await prepareChatFileAttachments(messages);
  const texts = result.map((message) =>
    message.parts.map((part) => (part.type === "text" ? part.text : ""))
  );

  for (const text of texts[1] ?? []) {
    expect(text.endsWith("[Attachment truncated]")).toBe(true);
    expect(text.length).toBeLessThan(100_100);
  }
  expect(texts[0]).toEqual([
    '[Attachment "old.txt" was not sent: the chat\'s attachment text limit is reached]',
  ]);
});
