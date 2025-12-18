"use client";

import { useSetAtom } from "jotai";
import { type ReactNode, useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { isLoadingUserAtom, userSessionAtom } from "@/utils/atoms/user";

export function UserProvider({ children }: { children: ReactNode }) {
  const setUserSession = useSetAtom(userSessionAtom);
  const setIsLoading = useSetAtom(isLoadingUserAtom);

  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    setUserSession(session ?? null);
  }, [session, setUserSession]);

  useEffect(() => {
    setIsLoading(isPending);
  }, [isPending, setIsLoading]);

  return <>{children}</>;
}

export { useUserContext } from "@/hooks/use-user";
