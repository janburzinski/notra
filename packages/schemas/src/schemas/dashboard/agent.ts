import "zod/compile";
import { z } from "zod";

export const agentStreamEventSchema = z.looseObject({
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

/** One stored line of an eve v27 session stream: every event a state change produced. */
export const agentStreamLineSchema = z.looseObject({
  facts: z.array(agentStreamEventSchema),
});

export class AgentTaskTimeoutError extends Error {
  constructor(sessionId: string) {
    super(`Agent task session ${sessionId} did not complete in time`);
    this.name = "AgentTaskTimeoutError";
  }
}

export class AgentTaskFailedError extends Error {
  constructor(sessionId: string, detail: string) {
    super(`Agent task session ${sessionId} failed: ${detail}`);
    this.name = "AgentTaskFailedError";
  }
}
