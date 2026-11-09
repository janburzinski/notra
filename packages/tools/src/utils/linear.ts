import { describeLinearToolError } from "@notra/ai/utils/linear";
import { logError } from "@notra/ai/utils/server-log";

/** Linear failures become a message for the model instead of a failed tool call. */
export async function runLinearTool<T>(
  toolName: string,
  context: { organizationId: string; integrationId: string },
  run: () => Promise<T>
): Promise<T | string> {
  try {
    return await run();
  } catch (error) {
    logError(`Linear tool ${toolName} failed`, error, context);
    return describeLinearToolError(error);
  }
}
