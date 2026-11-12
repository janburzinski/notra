import { describe, expect, mock, test } from "bun:test";

import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";

import { withFirstChunkFallback } from "./first-chunk-fallback";

const params: LanguageModelV4CallOptions = {
  prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
};

function textParts(text: string): LanguageModelV4StreamPart[] {
  return [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
  ];
}

function streamOf(parts: LanguageModelV4StreamPart[], hangAfter = false) {
  return new ReadableStream<LanguageModelV4StreamPart>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      if (!hangAfter) {
        controller.close();
      }
    },
  });
}

function fakeModel(
  modelId: string,
  doStream: LanguageModelV4["doStream"]
): LanguageModelV4 {
  return {
    specificationVersion: "v4",
    provider: "test",
    modelId,
    supportedUrls: {},
    doGenerate: () => Promise.reject(new Error("not used")),
    doStream: mock(doStream),
  };
}

function hangUntilAborted(options: LanguageModelV4CallOptions) {
  return new Promise<never>((_, reject) => {
    const abort = () => reject(new DOMException("aborted", "AbortError"));
    if (options.abortSignal?.aborted) {
      abort();
    }
    options.abortSignal?.addEventListener("abort", abort);
  });
}

async function readText(model: LanguageModelV4, options = params) {
  const { stream } = await model.doStream(options);
  let text = "";
  for await (const part of stream) {
    if (part.type === "text-delta") {
      text += part.delta;
    }
  }
  return text;
}

const fallback = () =>
  fakeModel("fallback", async () => ({ stream: streamOf(textParts("b")) }));

describe("withFirstChunkFallback", () => {
  test("keeps the primary stream when it answers in time", async () => {
    const primary = fakeModel("primary", async () => ({
      stream: streamOf(textParts("a")),
    }));
    const backup = fallback();

    expect(await readText(withFirstChunkFallback(primary, backup, 50))).toBe(
      "a"
    );
    expect(backup.doStream).not.toHaveBeenCalled();
  });

  test("falls back when the primary never responds", async () => {
    let primarySignal: AbortSignal | undefined;
    const primary = fakeModel("primary", (options) => {
      primarySignal = options.abortSignal;
      return hangUntilAborted(options);
    });

    expect(
      await readText(withFirstChunkFallback(primary, fallback(), 20))
    ).toBe("b");
    expect(primarySignal?.aborted).toBe(true);
  });

  test("falls back when the primary stream starts but sends nothing", async () => {
    const primary = fakeModel("primary", async () => ({
      stream: streamOf([{ type: "stream-start", warnings: [] }], true),
    }));

    expect(
      await readText(withFirstChunkFallback(primary, fallback(), 20))
    ).toBe("b");
  });

  test("does not fall back when the caller aborts", async () => {
    const caller = new AbortController();
    const primary = fakeModel("primary", hangUntilAborted);
    const backup = fallback();
    const reading = readText(withFirstChunkFallback(primary, backup, 1000), {
      ...params,
      abortSignal: caller.signal,
    });
    caller.abort();

    await expect(reading).rejects.toThrow("aborted");
    expect(backup.doStream).not.toHaveBeenCalled();
  });
});
