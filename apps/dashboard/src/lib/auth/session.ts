import { logError } from "@notra/ai/utils/server-log";
import { isNotFound, isRedirect } from "@tanstack/react-router";

import { getAuthIdentity, getAuthSession } from "@/lib/auth/server";
import type { GetServerSessionParams } from "@/types/auth/session";

function logUnlessNavigation(message: string) {
  return (error: unknown) => {
    if (isRedirect(error) || isNotFound(error)) {
      throw error;
    }
    logError(message, error);
    return null;
  };
}

export async function getServerSession(_params?: GetServerSessionParams) {
  const data = await getAuthSession().catch(
    logUnlessNavigation("Error getting server session")
  );
  return { session: data?.session, user: data?.user };
}

export async function getActiveOrganizationId(): Promise<string | null> {
  const { session } = await getServerSession();
  return session?.activeOrganizationId ?? null;
}

/** The signed-in user without resolving the active organization. */
export async function getServerIdentity(_params?: GetServerSessionParams) {
  const data = await getAuthIdentity().catch(
    logUnlessNavigation("Error getting server identity")
  );
  return { user: data?.user };
}
