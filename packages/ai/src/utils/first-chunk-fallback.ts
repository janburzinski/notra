import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
} from "@ai-sdk/provider";
import { logWarn } from "@notra/ai/utils/server-log";
import { wrapLanguageModel } from "ai";

function prependParts(
  parts: LanguageModelV4StreamPart[],
  reader: ReadableStreamDefaultReader<LanguageModelV4StreamPart>
): ReadableStream<LanguageModelV4StreamPart> {
  return new ReadableStream<LanguageModelV4StreamPart>(
    {
      async pull(controller) {
        const buffered = parts.shift();
        if (buffered) {
          controller.enqueue(buffered);
          return;
        }
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel: (reason) => reader.cancel(reason),
    },
    { highWaterMark: 0 }
  );
}

/** Cancels a stream that only opened after the deadline it lost to. */
async function cancelLateStream(
  streaming: PromiseLike<LanguageModelV4StreamResult>,
  deadline: AbortSignal
) {
  try {
    const late = await streaming;
    if (deadline.aborted) {
      await late.stream.cancel();
    }
  } catch {
    // The primary failed or was aborted; nothing is left open.
  }
}

/**
 * Starts the stream and waits for its first output part, so a provider that
 * accepts the request but never answers fails fast instead of hanging until
 * the HTTP client's 5 minute headers timeout. Returns null on timeout.
 */
async function streamWithDeadline(
  model: LanguageModelV4,
  params: LanguageModelV4CallOptions,
  timeoutMs: number
): Promise<LanguageModelV4StreamResult | null> {
  const deadline = new AbortController();
  const timedOut = new Promise<null>((resolve) => {
    deadline.signal.addEventListener("abort", () => resolve(null), {
      once: true,
    });
  });
  const timer = setTimeout(() => deadline.abort(), timeoutMs);

  const streaming = model.doStream({
    ...params,
    abortSignal: params.abortSignal
      ? AbortSignal.any([params.abortSignal, deadline.signal])
      : deadline.signal,
  });
  cancelLateStream(streaming, deadline.signal);

  try {
    const result = await Promise.race([streaming, timedOut]);
    if (!result) {
      return null;
    }

    const reader = result.stream.getReader();
    const parts: LanguageModelV4StreamPart[] = [];
    for (;;) {
      const next = await Promise.race([reader.read(), timedOut]);
      if (!next) {
        // Don't let a slow cancel delay the fallback.
        reader.cancel().catch(() => undefined);
        return null;
      }
      if (next.done) {
        break;
      }
      parts.push(next.value);
      if (next.value.type !== "stream-start") {
        break;
      }
    }
    return { ...result, stream: prependParts(parts, reader) };
  } catch (error) {
    if (deadline.signal.aborted && !params.abortSignal?.aborted) {
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Streams from `primary`, and if it produces no output within `timeoutMs`,
 * cancels it and streams the same request from `fallback` instead.
 */
export function withFirstChunkFallback(
  primary: LanguageModelV4,
  fallback: LanguageModelV4,
  timeoutMs: number
): LanguageModelV4 {
  return wrapLanguageModel({
    model: primary,
    middleware: {
      wrapStream: async ({ params }) => {
        const result = await streamWithDeadline(primary, params, timeoutMs);
        if (result) {
          return result;
        }
        logWarn("[AI] Model sent no output in time, using fallback model", {
          model: primary.modelId,
          fallbackModel: fallback.modelId,
          timeoutMs,
        });
        return fallback.doStream(params);
      },
    },
  });
}
