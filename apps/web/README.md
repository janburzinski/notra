# web

Public website at [www.usenotra.com](https://www.usenotra.com), built with [TanStack Start](https://tanstack.com/start) on Vite.

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001).

- Routes live in `src/routes` (file-based, `src/routeTree.gen.ts` is generated).
- AI traffic tracking runs in the Vercel edge middleware `middleware.ts`. Markdown negotiation and redirects live in `src/start.ts`.
- Blog and changelog content is MDX in `src/content`, compiled by `fumadocs-mdx` into `.source`.
