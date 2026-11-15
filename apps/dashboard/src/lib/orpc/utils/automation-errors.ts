import { AutomationServiceError } from "@/lib/automation/errors";
import { getTranslations } from "@/lib/i18n/server";

import { badRequest, conflict, internalServerError, notFound } from "./errors";

async function manualRunErrorMessage(code: unknown): Promise<string> {
  const tErrors = await getTranslations("errors.automation");
  switch (code) {
    case "NO_TARGET_REPOSITORY":
      return tErrors("noTargetRepository");
    case "TRIGGER_DISABLED":
      return tErrors("triggerDisabled");
    case "UNSUPPORTED_SOURCE_TYPE":
      return tErrors("manualRunUnsupported");
    default:
      return (await getTranslations("errors.server"))("notFound");
  }
}

/** The translated RPC error for a refused automation change. */
async function toAutomationRpcError(error: AutomationServiceError) {
  const tErrors = await getTranslations("errors.automation");
  switch (error.code) {
    case "NOT_FOUND":
      return notFound(error.message);
    case "BAD_REQUEST":
      return badRequest(error.message);
    case "DUPLICATE_TRIGGER":
      return conflict(tErrors("duplicateTrigger"), error.data);
    case "DUPLICATE_ALERT":
      return conflict(error.message, error.data);
    case "INTEGRATION_NOT_FOUND":
      return badRequest(tErrors("integrationsMissing"), error.data);
    case "INVALID_DESTINATION_URL":
      return badRequest(tErrors("externalUrlMissing"), error.data);
    case "EVENT_TRIGGERS_ONLY":
      return badRequest(tErrors("eventTriggersOnly"));
    case "MANUAL_RUN":
      return badRequest(
        await manualRunErrorMessage(error.data?.code),
        error.data
      );
    case "INTERNAL":
      return internalServerError(error.message, error.cause);
    default: {
      const exhaustive: never = error.code;
      return exhaustive;
    }
  }
}

/** Runs an automation service call, translating its refusals for the dashboard. */
export async function withAutomationRpcErrors<T>(
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AutomationServiceError) {
      throw await toAutomationRpcError(error);
    }
    throw error;
  }
}
