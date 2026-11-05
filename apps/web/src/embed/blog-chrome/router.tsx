// The blog on Notra Sites has no TanStack router, so links load the page like any other anchor.
import { useEffect } from "react";
import type { ReactNode } from "react";

import type {
  BlogChromeLinkProps,
  BlogChromeLocation,
  BlogChromeNavigateProps,
} from "@/types/blog-chrome";

export function Link({
  to,
  href,
  reloadDocument: _reload,
  children,
  ...props
}: BlogChromeLinkProps) {
  return (
    <a href={href ?? to} {...props}>
      {children}
    </a>
  );
}

export function useLocation<T>(options?: {
  select?: (location: BlogChromeLocation) => T;
}) {
  const location = {
    pathname: typeof window === "undefined" ? "/" : window.location.pathname,
  };
  return options?.select ? options.select(location) : location;
}

export function ClientOnly({ children }: { children?: ReactNode }) {
  return children;
}

export function Navigate({ to, href, replace }: BlogChromeNavigateProps) {
  useEffect(() => {
    const target = href ?? to;
    if (target) {
      window.location[replace ? "replace" : "assign"](target);
    }
  }, [href, to, replace]);
  return null;
}
