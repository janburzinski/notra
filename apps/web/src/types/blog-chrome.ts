import type { AnchorHTMLAttributes, ReactNode } from "react";

export type BlogChromeLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
  reloadDocument?: boolean;
  children?: ReactNode;
};

export interface BlogChromeLocation {
  pathname: string;
}

export type BlogChromeMount = (host: HTMLElement) => ReactNode;

export interface BlogChromeNavigateProps {
  to?: string;
  href?: string;
  replace?: boolean;
}
