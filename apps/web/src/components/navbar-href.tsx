import { Link } from "@tanstack/react-router";

import type { NavbarHrefProps } from "@/types/navbar";
import { isProxiedPath } from "@/utils/proxied-paths";

export function NavbarHref({
  href,
  external,
  className,
  onClick,
  children,
  role,
}: NavbarHrefProps) {
  if (external) {
    return (
      <a
        className={className}
        href={href}
        onClick={onClick}
        rel="noopener noreferrer"
        role={role}
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      className={className}
      to={href}
      onClick={onClick}
      reloadDocument={isProxiedPath(href)}
      role={role}
    >
      {children}
    </Link>
  );
}
