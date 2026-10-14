import type { APIRoute } from "astro";

const SITE_ORIGIN = (process.env.NOTRA_SITE_ORIGIN ?? "https://fernhill-astro.notra.site").replace(/\/$/, "");

const DROPPED_REQUEST_HEADERS = [
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-connection",
  "content-length",
  "cookie",
  "authorization",
];

// fetch() decodes compressed bodies, so these no longer describe the body.
const DROPPED_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

export const proxyToNotra: APIRoute = async ({ request, clientAddress }) => {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const name of DROPPED_REQUEST_HEADERS) {
    headers.delete(name);
  }
  headers.set("x-forwarded-for", clientAddress);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(`${SITE_ORIGIN}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(upstream.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) {
    responseHeaders.delete(name);
  }
  responseHeaders.set("X-Astro-Reroute", "no");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
};
