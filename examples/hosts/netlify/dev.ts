import { join, normalize } from "node:path";
import config from "./netlify.toml";

interface Redirect {
  from: string;
  to: string;
  status?: number;
  force?: boolean;
}

const NOTRA_ADDRESS = "https://tidepool-netlify.notra.site";
const origin = (process.env.NOTRA_SITE_ORIGIN ?? NOTRA_ADDRESS).replace(/\/$/, "");
const port = Number(process.env.PORT ?? 8888);
const publicDir = join(import.meta.dir, "public");
const redirects = (config as { redirects: Redirect[] }).redirects;

const DROPPED_REQUEST_HEADERS = ["cookie", "authorization", "host", "connection"];
// fetch() decompresses the body, so these no longer describe it.
const DROPPED_RESPONSE_HEADERS = ["content-encoding", "content-length", "transfer-encoding", "connection"];

const matchRule = (pathname: string): string | undefined => {
  for (const rule of redirects) {
    if (rule.from.endsWith("/*")) {
      const prefix = rule.from.slice(0, -1);
      if (pathname.startsWith(prefix)) {
        return rule.to.replace(":splat", pathname.slice(prefix.length));
      }
    } else if (pathname === rule.from) {
      return rule.to;
    }
  }
  return undefined;
};

const proxy = async (request: Request, target: string, ip: string): Promise<Response> => {
  const url = new URL(request.url);
  const upstream = new URL(target.replace(NOTRA_ADDRESS, origin));
  upstream.search = url.search;

  const headers = new Headers(request.headers);
  for (const name of DROPPED_REQUEST_HEADERS) headers.delete(name);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-for", ip);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers(response.headers);
  for (const name of DROPPED_RESPONSE_HEADERS) responseHeaders.delete(name);
  return new Response(response.body, { status: response.status, headers: responseHeaders });
};

const serveStatic = async (pathname: string): Promise<Response> => {
  const relative = normalize(pathname === "/" ? "/index.html" : pathname);
  const file = Bun.file(join(publicDir, relative));
  if (relative.includes("..") || !(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file);
};

Bun.serve({
  port,
  async fetch(request, server) {
    const { pathname } = new URL(request.url);
    const target = matchRule(pathname);
    if (target) {
      const ip = server.requestIP(request)?.address ?? "127.0.0.1";
      return proxy(request, target, ip);
    }
    return serveStatic(pathname);
  },
});

console.log(`Tidepool on http://localhost:${port}, /blog and /changelog from ${origin}`);
