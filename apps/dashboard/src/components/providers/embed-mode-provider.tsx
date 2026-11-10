"use client";

import { createContext, type ReactNode, useContext } from "react";

const EmbedModeContext = createContext(false);

/**
 * Public embeds render on other companies' sites. Components that would load
 * images from third parties (flags, brand logos) or call signed-in APIs check
 * this and fall back to local rendering, so a visitor's browser only talks
 * to Notra.
 */
export function EmbedModeProvider({
  embed,
  children,
}: {
  embed: boolean;
  children: ReactNode;
}) {
  return <EmbedModeContext value={embed}>{children}</EmbedModeContext>;
}

export function useIsEmbed(): boolean {
  return useContext(EmbedModeContext);
}
