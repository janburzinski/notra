import { agentStreamLineSchema } from "@notra/schemas/dashboard/agent";

import type { AgentStreamEvent, AgentTaskStreamResult } from "@/types/agent";

export async function readAgentTaskStream(
  response: Response,
  signal: AbortSignal,
  deadline: number
): Promise<AgentTaskStreamResult> {
  if (!(response.ok && response.body)) {
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output: unknown;
  let completed = false;
  let failed: string | null = null;
  const cancel = () => {
    void reader.cancel(signal.reason).catch(() => {});
  };
  const checkDeadline = () => {
    signal.throwIfAborted();
    if (Date.now() >= deadline) {
      throw new DOMException("Agent task deadline exceeded", "TimeoutError");
    }
  };
  // eve v27 streams store `{ at, facts }` event lines next to progress and
  // transport records. Sessions stay open after a turn, so the task is done
  // when its turn settles, not when the stream closes.
  const consumeEvent = (event: AgentStreamEvent): boolean => {
    const data = event.data ?? {};
    if (event.type === "content.completed" && data.kind === "result") {
      output = data.value;
      return false;
    }
    if (event.type === "turn.settled") {
      if (data.outcome === "completed") {
        completed = true;
      } else {
        failed ??= errorMessage(data.error) ?? `turn ${String(data.outcome)}`;
      }
      return true;
    }
    if (event.type === "session.ended") {
      if (data.outcome !== "completed") {
        failed = errorMessage(data.error) ?? "session failed";
      } else if (!completed) {
        failed ??= "session ended before the task finished";
      }
      return true;
    }
    return false;
  };
  const consumeLine = (line: string): boolean => {
    checkDeadline();
    let parsed;
    try {
      parsed = agentStreamLineSchema.safeParse(JSON.parse(line.trim()));
    } catch {
      return false;
    }
    if (!parsed.success) {
      return false;
    }
    // Read the whole line: a failed session records its turn as cancelled and
    // the error on `session.ended` in the same line.
    let settled = false;
    for (const event of parsed.data.facts) {
      settled = consumeEvent(event) || settled;
    }
    return settled;
  };

  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      checkDeadline();
      const { value, done } = await reader.read();
      checkDeadline();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let start = 0;
      let newline = buffer.indexOf("\n");
      let settled = false;
      while (newline !== -1 && !settled) {
        settled = consumeLine(buffer.slice(start, newline));
        start = newline + 1;
        newline = buffer.indexOf("\n", start);
      }
      buffer = buffer.slice(start);
      if (settled) {
        break;
      }
      if (done) {
        if (buffer.trim()) {
          consumeLine(buffer);
        }
        break;
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  if (failed) {
    return { failed };
  }
  return completed ? { output } : null;
}

function errorMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return undefined;
  }
  return typeof error.message === "string" ? error.message : undefined;
}
