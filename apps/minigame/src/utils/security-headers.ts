/** Headers for every response. The CSP is left out in dev, where Vite needs inline modules and HMR. */
export function buildSecurityHeaders(
  isDevelopment: boolean
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Frame-Options": "DENY",
  };
  if (isDevelopment) {
    return headers;
  }
  return {
    ...headers,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob: pbs.twimg.com abs.twimg.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://x.com https://twitter.com",
      "upgrade-insecure-requests",
    ].join("; "),
  };
}
