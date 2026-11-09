---
name: weekly-changelog
description: Write the weekly Notra changelog entry on Notra Sites (apps/blog/changelog, served at usenotra.com/changelog) with one product photo. Use when asked to write, update or check the changelog, summarize what shipped this week, or add a changelog photo.
---

# Weekly changelog

The changelog is part of the ntra-blog Notra site in `apps/blog`, next to the blog. Merging to `main` publishes it at `https://www.usenotra.com/changelog`. There is one entry per week, usually on Friday, and each entry has one product photo.

Use [the 2026-11-09 entry](../../../apps/blog/changelog/sites-for-everyone-one-analytics-page-autopilot-workflows.mdx) as the model for tone and structure.

## 1. Find what shipped

Start the day after the newest entry's `date` and end today:

```sh
git fetch origin main
git log origin/main --first-parent --since=<day after last entry> --format='%ad %s' --date=short \
  | grep -vE '^\S+ (chore|ci|test|build|docs|refactor|style)(\(|:)'
```

- Read the body of every candidate with `gh pr view <n> --json title,body`. Never write a line from the title alone. Titles left out details, and early drafts got tab names, model behavior and Slack reactions wrong.
- Some changes must stay out this week: anything that is behind a flag, not deployed yet, or whose PR says it can't reach production before a date. A model swap waiting for the sub-processor notice is one example. Put these in the week they go live.
- **Include:** features and fixes a user can see or would have noticed.
- **Leave out:**
  - security hardening details
  - internal performance work
  - refactors, tests, CI, deploy tooling and E2E fixes
  - anything that only affects the team

## 2. Write the entry

Create `apps/blog/changelog/<slug>.mdx`, with the slug taken from the title. Don't put a date prefix in the filename, because the slug is the URL.

```mdx
---
title: "Sites for every workspace, one Analytics page and Autopilot workflows"
description: "One sentence. It is the card text, the minimap text and the email's summary."
date: 2026-11-09
image: /changelog/2026-11-09-analytics.webp
imageAlt: "What the photo shows, in a full sentence."
---

## <Headline change>

<One or two sentences on what changed and why it matters.>

- **<Detail>:** <what the user can now do>.

## Also new

- **<Area>:** <one line>.

## Fixes

- <What works now, from the user's side>.
```

- **Title:** the two or three biggest changes, in sentence case.
- **Sections:** give each of the two or three big changes its own `##` section. Everything else goes under "Also new" and "Fixes".
- **No GitHub links:** the repo is private, so PR, issue and commit links 404 for readers. Also leave out author credits.
- **No `tags`:** the page shows them inline, and we don't want that.
- **Links:** only to public pages that are already live, such as docs or usenotra.com pages. The link checker fails on anything else.
- **Wording:** plain words about what the user sees and does, not how it was built. Run the `humanizer` skill over the draft.

## 3. Add the photo

- One photo per entry, showing the headline change.
- Take it from demo.usenotra.com, which has fake data. Never use a real workspace, production credentials or customer data.
- The demo is behind Cloudflare Turnstile, so headless Playwright gets stuck. Use a real browser, such as the T3 preview browser, and never try to get around the check. A clean screenshot in the headline PR works too.
- Use a 1280×800 viewport in light mode, at 2x when the tool allows it.

Convert the photo and save it:

```sh
cwebp -q 90 shot.png -o apps/blog/public/changelog/<date>-<topic>.webp
```

Reference it in the frontmatter as `/changelog/<date>-<topic>.webp`, without the mount. The site serves it under `/changelog/`.

## 4. Preview and check

```sh
cd apps/sites-builder
bun compiler/cli.ts dev --source ../blog --mount blog=/blog --mount changelog=/changelog --port 4391
# http://localhost:4391/changelog
```

From the repo root:

```sh
node scripts/github/check-blog-links.mjs && rm comment.md
bun run check
```

Open the PR with the `pr-workflow` skill, with a title like `docs(changelog): add the November 7 changelog`. The Blog workflow checks the links again on the PR.
