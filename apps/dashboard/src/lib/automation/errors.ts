import type { AutomationServiceErrorCode } from "@/types/automation/service";

/**
 * A refused automation change. The message is plain English for the chat
 * agent; the dashboard router maps the code to its translated RPC error.
 */
export class AutomationServiceError extends Error {
  readonly code: AutomationServiceErrorCode;
  readonly data?: Record<string, unknown>;

  constructor(
    code: AutomationServiceErrorCode,
    message: string,
    options: { data?: Record<string, unknown>; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "AutomationServiceError";
    this.code = code;
    this.data = options.data;
  }
}
