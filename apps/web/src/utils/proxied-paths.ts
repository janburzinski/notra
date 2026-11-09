import { BLOG_PROXY_PATH, CHANGELOG_PROXY_PATH } from "@/constants/proxy";

const PROXIED_PATHS = [BLOG_PROXY_PATH, CHANGELOG_PROXY_PATH];

// Vercel forwards these paths to another origin before the app sees them, so
// links to them must load the document instead of routing on the client.
export function isProxiedPath(href: string): boolean {
  return PROXIED_PATHS.some(
    (path) => href === path || href.startsWith(`${path}/`)
  );
}
