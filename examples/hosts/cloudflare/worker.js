import { landingPage } from "./landing.js";

const DEFAULT_SITE_ORIGIN = "https://relaywave-cloudflare.notra.site";
const MOUNTS = ["/blog", "/changelog"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const mounted = MOUNTS.some(
      (mount) => url.pathname === mount || url.pathname.startsWith(`${mount}/`)
    );
    if (!mounted) {
      if (env.PASS_THROUGH === "true") {
        return fetch(request);
      }
      return serveLandingPage(url);
    }
    const siteOrigin = env.NOTRA_SITE_ORIGIN ?? DEFAULT_SITE_ORIGIN;
    const headers = new Headers(request.headers);
    headers.delete("cookie");
    headers.delete("authorization");
    headers.set("x-forwarded-for", request.headers.get("cf-connecting-ip") ?? "");
    return fetch(new URL(url.pathname + url.search, siteOrigin), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });
  },
};

function serveLandingPage(url) {
  if (url.pathname !== "/") {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
  return new Response(landingPage, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
