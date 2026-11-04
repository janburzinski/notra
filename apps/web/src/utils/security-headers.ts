import { APP_URL } from "./urls";

const LOCAL_DASHBOARD_ORIGIN = "http://localhost:3000";

// Notra Sites sends its own CSP, X-Content-Type-Options and Referrer-Policy.
export const PROXIED_SITE_SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-DNS-Prefetch-Control": "on",
};

export function buildSecurityHeaders(isDevelopment: boolean) {
  const dashboardSessionOrigin = isDevelopment
    ? LOCAL_DASHBOARD_ORIGIN
    : APP_URL;

  return {
    ...PROXIED_SITE_SECURITY_HEADERS,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' databuddy.cc *.databuddy.cc https://challenges.cloudflare.com www.dubcdn.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: databuddy.cc *.databuddy.cc avatars.githubusercontent.com www.google.com *.gstatic.com cdn.contentport.io media.brand.dev logos.context.dev *.r2.dev cdn.usenotra.com pbs.twimg.com abs.twimg.com i.imgur.com",
      `connect-src 'self' databuddy.cc *.databuddy.cc api.dub.co *.inth.app *.c15t.com *.c15t.dev i.imgur.com ${dashboardSessionOrigin}`,
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  };
}
