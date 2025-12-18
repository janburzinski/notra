import { useAtomValue } from "jotai";
import {
  isAuthenticatedAtom,
  isLoadingUserAtom,
  userSessionAtom,
} from "@/utils/atoms/user";

export function useUserContext() {
  const session = useAtomValue(userSessionAtom);
  const isLoading = useAtomValue(isLoadingUserAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  console.log("user session", session);

  return {
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated,
  };
}
