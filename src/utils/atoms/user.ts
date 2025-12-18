import { atom } from "jotai";
import type { authClient } from "@/lib/auth/client";

export type UserSession = NonNullable<
  ReturnType<typeof authClient.useSession>["data"]
>;

export const userSessionAtom = atom<UserSession | null>(null);
export const isLoadingUserAtom = atom<boolean>(true);

export const isAuthenticatedAtom = atom((get) => {
  const session = get(userSessionAtom);
  return !!session;
});
