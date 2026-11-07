# Notra Sites local development

The Notra CLI ships the same compiler and Astro theme as hosted Notra Sites in
its `sites/` folder, exported from this workspace. Local previews need no login
or API key. Node.js 22.12 or newer can run the CLI without Bun; Bun can also run it
directly.

From a site folder containing `blog.json`, `blog/`, or `changelog/`:

```bash
notra dev
notra dev --source ./hosted-site --port 4400
```

Without a global CLI installation:

```bash
npx notra@latest dev
bunx --bun notra@latest dev
```

The default address is `http://localhost:4321`. The blog and changelog are served
under `/blog` and `/changelog` when the site has a `blog/` or `changelog/` folder
(both when it has neither), and `/` redirects to the first one. Drafts are included,
and analytics integrations are disabled. Content, styling, components, and
configuration refresh when their source files change. Stop with Ctrl+C.

### Serve a section at another path

To preview the site at the path you will serve it from, for example behind
your own proxy, pass `--mount <section>=<path>` once per section. Only the
sections you list are served:

```bash
notra dev --mount blog=/newsroom
notra dev --mount blog=/news --mount changelog=/releases
```

Paths start with `/` and use lowercase letters, digits and dashes, at most three
segments deep. `/` mounts a section at the root. The two sections need different
paths that don't contain each other, unless one of them is `/`.

### Check and build a site

```bash
notra sites validate
notra sites build --mount blog=/newsroom
```

`validate` checks `blog.json`, MDX and snippets without building, and the links
and images it can check without the built pages (`notra dev` does too, on every
reload); `#fragments`, generated pages and links in drafts wait for `build`,
which checks all of them against the files it wrote. `build` makes
the same static output a hosted deployment serves, in `./.notra/out` by default
(`--out <dir>` to change it), with each section in the folder of its path, such
as `.notra/out/newsroom/`. Sections and `--mount` work as in `notra dev`. A local
build leaves out drafts, like a hosted build, and is marked `noindex`.
Canonical links, feeds and sitemaps use `http://localhost` unless you pass
`--origin https://www.example.com`.

The renderer takes the same flags directly, for example
`bun compiler/cli.ts build --source /path/to/site --out out --mount blog=/newsroom`.
With `--target <file>` (the hosted build request), `--mount` and `--origin`
replace the target's mounts and public origin and keep the rest.

## Work on the renderer

```bash
cd apps/sites-builder
bun dev
bun compiler/cli.ts dev --source /path/to/site --port 4400
```

`bun dev` uses the demo fixture. The Worker in `apps/sites` is the production
delivery layer, not the content preview server.

## Ship it in the CLI

```bash
bun run export:cli /path/to/notra-cli
```

This bundles the compiler, copies it with the Astro theme into the CLI's
`sites/` folder, and syncs the renderer's runtime dependencies into the CLI's
`package.json`. Workspace-only compiler dependencies are bundled into
`sites/dist/cli.mjs`. See `release.md` for the release steps.

To run the Notra CLI against an unreleased renderer without exporting:

```bash
bun run bundle
NOTRA_SITES_RUNTIME=/absolute/path/to/apps/sites-builder/dist/cli.mjs notra dev
```
