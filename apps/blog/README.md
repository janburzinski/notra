# Notra blog

The source of [usenotra.com/blog](https://www.usenotra.com/blog), hosted on Notra Sites. It isn't a workspace package: Notra builds this folder (site root directory `apps/blog`) on every push to `main` that touches it, and serves it at `https://ntra-blog.notra.site/blog`. usenotra.com forwards `/blog` and `/blog/*` there with a Vercel edge route (`apps/web/vite.config.ts`).

| Path | What it is |
| --- | --- |
| `blog/*.mdx` | Posts. Frontmatter: `title`, `description`, `date`, `updated`, `author`, optional `image` and `hidden` |
| `blog.json` | Site settings: authors, colors, fonts, layout, consent banner |
| `header.mdx`, `footer.mdx`, `style.css`, `script.js` | The footer, the navbar fallback, diagram animations and page transitions |
| `scripts/web-chrome.js` | Generated: the real usenotra.com navbar and Paper dither backgrounds (see below) |
| `slots/` | The index hero and the call to action under every post |
| `snippets/` | React components for posts (they may only import from `react`) |
| `public/` | Images and fonts, served from `/blog/...` |

Publish new posts in `blog/` only: usenotra.com/blog is served from this folder, and `apps/web` no longer has a blog.

## Navbar and dither backgrounds

`scripts/web-chrome.js` is built from `apps/web`, so the navbar, its menus and the dither backgrounds stay identical to usenotra.com. Every element marked `data-notra-web="navbar"`, `"hero-dither"`, `"cta-dither"` or `"footer-dither"` gets the matching component, and post cards get theirs automatically. Each renders in its own Shadow DOM, so its styles and the blog's never mix. The navbar's `data-page={props.page}` picks its layout: it floats over the hero on the index and sits in the page flow on every other page. Until the script runs (or without JavaScript), the static navbar in `header.mdx` shows.

After changing the navbar or a dither component in `apps/web` or `packages/ui`, regenerate the bundle and commit it. CI fails while it is out of date:

```bash
cd apps/web && bun run blog:chrome
```

The same command writes `public/licenses/web-chrome.txt`, with the licenses and NOTICE files of every package in the bundle. The bundle's header points to it.

## Preview

Preview locally with live reload:

```bash
cd apps/blog && npx notra@latest dev
```

To preview with an unreleased renderer from this repo, run `bun compiler/cli.ts dev --source ../blog` in `apps/sites-builder`.

`apps/blog/package.json` only stops `npx` here, and the root `workspaces` excludes this folder. Without it, npm reads the root `package.json` and fails on its `catalog:` versions with matching `overrides`.

To try it inside usenotra.com, serve it on a local Sites worker and start the web app with `BLOG_DEV_PROXY_ORIGIN` pointing at it. See [Sites docs](https://www.usenotra.com/docs/sites/overview) for everything `blog.json` and MDX support.
