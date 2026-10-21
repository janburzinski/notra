"use client";
import { createContext, useContext } from "react";

import type { SiteWorkspaceValue } from "@/types/site-workspace";
export const SiteWorkspaceContext = createContext<SiteWorkspaceValue | null>(
  null
);
export function useSiteWorkspace() {
  return useContext(SiteWorkspaceContext);
}
