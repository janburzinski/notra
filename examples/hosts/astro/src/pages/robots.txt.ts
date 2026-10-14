import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? "";
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${origin}/blog/sitemap.xml`,
    `Sitemap: ${origin}/changelog/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
