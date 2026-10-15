"use client";

import { useFlag } from "@databuddy/sdk/react";
import { createContext, type ReactNode, use, useEffect, useState } from "react";

import { JOBS_SIDEBAR_FLAG_KEY } from "@/constants/nav";
import { setJobsSidebarCookie } from "@/utils/cookies";

const JobsSidebarContext = createContext(false);

/**
 * Starts from the cookie the server render read, so a flagged user does not
 * see the old sidebar swap out after hydration. The flag settles it afterwards
 * and the cookie follows it for the next load.
 */
export function JobsSidebarProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: boolean;
}) {
  const flag = useFlag(JOBS_SIDEBAR_FLAG_KEY);
  const [enabled, setEnabled] = useState(initial);
  const resolved = process.env.NODE_ENV === "development" || flag.on;
  const ready =
    process.env.NODE_ENV === "development" || flag.status === "ready";

  useEffect(() => {
    if (!ready || resolved === enabled) {
      return;
    }
    setEnabled(resolved);
    setJobsSidebarCookie(resolved).catch(() => {
      // The cookie only speeds up the next render.
    });
  }, [ready, resolved, enabled]);

  return <JobsSidebarContext value={enabled}>{children}</JobsSidebarContext>;
}

export function useJobsSidebar(): boolean {
  return use(JobsSidebarContext);
}
