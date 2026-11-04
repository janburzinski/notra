# Notra blog

The source of [usenotra.com/blog](https://www.usenotra.com/blog), hosted on Notra Sites. It isn't a workspace package: Notra builds this folder (site root directory `apps/blog`) on every push to `main` that touches it, and serves it at `https://notra-blog.notra.site/blog`. usenotra.com forwards `/blog` and `/blog/*` there with a Vercel edge route (`apps/web/vite.config.ts`).

| Path | What it is |
| --- | --- |
| `blog/*.mdx` | Posts. Frontmatter: `title`, `description`, `date`, `updated`, `author`, optional `image` and `hidden` |
| `blog.json` | Site settings: authors, colors, fonts, layout, consent banner |
| `header.mdx`, `footer.mdx`, `style.css`, `script.js` | The usenotra.com navbar and footer |
| `slots/` | The index hero and the call to action under every post |
| `snippets/` | React components for posts (they may only import from `react`) |
| `public/` | Images and fonts, served from `/blog/...` |

Until usenotra.com/blog is served from here, the old blog in `apps/web/src/content/blog` still exists. Add every new post to both folders (CI checks it), with `updatedAt` renamed to `updated`.

Preview locally with live reload:

```bash
cd apps/blog && npx notra@latest dev
```

To preview with an unreleased renderer from this repo, run `bun compiler/cli.ts dev --source ../blog` in `apps/sites-builder`.

`apps/blog/package.json` only stops `npx` here, and the root `workspaces` excludes this folder. Without it, npm reads the root `package.json` and fails on its `catalog:` versions with matching `overrides`.

To try it inside usenotra.com, serve it on a local Sites worker and start the web app with `BLOG_DEV_PROXY_ORIGIN` pointing at it. See [Sites docs](https://www.usenotra.com/docs/sites/overview) for everything `blog.json` and MDX support.
