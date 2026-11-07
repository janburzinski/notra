import { BLOG_PROXY_PATH } from "@/constants/proxy";

// Vercel forwards these paths to another origin before the app sees them, so
// links to them must load the document instead of routing on the client.
export function isProxiedPath(href: string): boolean {
  return href === BLOG_PROXY_PATH || href.startsWith(`${BLOG_PROXY_PATH}/`);
}
