import { workosErrorSchema } from "@notra/schemas/dashboard/auth/workos-error";
import { NotFoundException } from "@workos-inc/node";

export interface WorkOSErrorInfo {
  code: string | null;
  message: string;
  email: string | null;
  pendingAuthenticationToken: string | null;
  organizationIds: string[];
}

export function readWorkOSError(error: unknown): WorkOSErrorInfo {
  const parsed = workosErrorSchema.safeParse(error);

  if (!parsed.success) {
    return {
      code: null,
      message: "Unable to sign you in. Please try again.",
      email: null,
      pendingAuthenticationToken: null,
      organizationIds: [],
    };
  }

  const { code, message, rawData } = parsed.data;

  return {
    code: rawData?.code ?? code ?? null,
    message: rawData?.message ?? message ?? "Unable to sign you in. Please try again.",
    email: rawData?.email ?? null,
    pendingAuthenticationToken: rawData?.pending_authentication_token ?? null,
    organizationIds:
      rawData?.organizations?.map((organization) => organization.id) ?? [],
  };
}

export function isWorkOSNotFound(error: unknown): boolean {
  return error instanceof NotFoundException;
}
