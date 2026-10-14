import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? "";
  const body = `# Fernhill

> Fernhill is a plant-care app for iOS and Android that plans watering from pot size, light and season.

## Sections

- [Blog](${origin}/blog/llms.txt): plant-care guides and product news
- [Changelog](${origin}/changelog/llms.txt): every release of the app
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
