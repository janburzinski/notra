# Default template

A deployable blog and changelog for Notra hosted sites, using the default Notra theme. No custom CSS, components, fonts, analytics or build configuration. Layout, colors, light/dark appearance, navigation and post features come from the platform defaults.

## Deploy from this repository

1. Open **Sites → New site** in Notra and select this repository and the branch containing this example.
2. Enable **Site is in a subdirectory** and enter `examples/sites/default`.
3. Set the blog path to `/blog` and the changelog path to `/changelog`.
4. Deploy to your Notra-provided hostname or connect a custom domain.

For a blog-only site, set the blog path to `/` and leave the changelog path empty. On an existing site, change the paths and disable the changelog under **Settings → Content → Sections**. Section paths are dashboard settings, not `blog.json` fields.

## Make it yours

Copy this folder into your own repository, then update the name, descriptions and author in `blog.json`. Replace the sample posts in `blog/` and release notes in `changelog/`. Every post starts with frontmatter containing a `title` and `date`; the file name determines its URL.

Keep the configuration small to follow future platform defaults. Add overrides only when you need them; see the [blog.json reference](https://usenotra.com/docs/sites/reference/blog-json).

```text
blog.json       site name, descriptions and author
blog/           sample blog posts
changelog/      sample release notes
```
