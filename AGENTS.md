# AGENTS.md

## Project

Notra is a Bun + Turborepo monorepo. See `README.md` and `CONTRIBUTING.md` for
setup, architecture, and the standard workflow; use `package.json` for commands.
Use the Bun and Node versions pinned there, not assumptions about a cloud image.

## Ponytail

Codex, Claude Code, and OpenCode use Ponytail's native plugin; respect its current
mode, including off. See CONTRIBUTING.md for setup. In Amp, for coding tasks,
read and apply `.agents/skills/ponytail/SKILL.md` from the repository root,
defaulting to full unless the user chooses another level or disables Ponytail.
Explicit requirements and this repo's conventions take precedence. Companion
`ponytail-*` skills are available on request.

## Repository-specific guidance

- The dashboard and public website use TanStack Start, Vite, and Nitro, not
  Next.js. Existing `NEXT_PUBLIC_*` environment names are retained for
  compatibility. Read `apps/dashboard/AGENTS.md` before changing the dashboard.
- Dashboard authentication uses WorkOS AuthKit. Local impersonation requires
  `DEV_AUTH_ENABLED=true` and `DEV_AUTH_EMAIL`, and only works on loopback.
  Never enable it when exposing the app through a public tunnel; use WorkOS.
- Run `bun install` before working with Effect when dependencies or
  `.repos/effect` are missing. The existing prepare script bootstraps the source
  checkout and intentionally skips Vercel, CI, and production. Do not add a
  second bootstrap mechanism.
- Use committed migrations for database setup (`bun run db:migrate`). The
  journal starts with `0000_baseline`; do not replace it with schema export/push
  workarounds or rewrite applied migrations. See CONTRIBUTING.md for validation.
- New task environment variables must be declared in `turbo.json#globalEnv`
  because Turbo uses strict environment filtering.
- Use the repository's Ultracite/Oxlint/Oxfmt configuration, not a separate
  style guide. Run `bun run check` and the affected workspaces' tests, type
  checks, and builds as appropriate. Vite builds do not perform type checking.
- The dashboard, `@notra/ai`, `@notra/agent` and `@notra/geo-core` run tests
  with `bun test --parallel`: each file gets its own worker global, and files
  run in any order. Keep each file self-contained, and restore mocks, spies,
  fake timers, env vars and module-level caches in `afterEach` so tests in the
  same file don't depend on order. Check with `bun test --randomize`.
- The pre-commit hook formats staged supported files, regenerates
  `apps/blog/scripts/web-chrome.js` when `apps/web`, `packages/ui`,
  `packages/utils` or `bun.lock` change, and runs Knip. Do not overwrite
  unrelated or partially staged changes to make it pass.
- The pre-push hook checks the formatting, lint and Effect lint of files
  changed since `origin/main` and type checks the packages they belong to. It
  only checks the checked-out commit, so commit or stash first and push the
  current branch. Fix what it reports; don't push with `--no-verify`.
- GitHub cannot require checks on this repository, so nothing blocks a red
  merge. Never merge a pull request while any `Code quality` check fails, even
  one that looks unrelated; a red `main` blocks production releases and every
  later PR. If `main` is red, fix it before merging anything else.
- Never use production credentials or customer data for verification.
- Before adding or swapping any third-party SDK, external API, hosting provider,
  AI gateway, AI provider called directly, model from a maker not yet on
  `/subprocessors`, analytics or logging tool, or a new external env var, and
  before editing the legal pages, data retention, deletion or AI privacy flags,
  read and apply `.agents/skills/dpa-check/SKILL.md`. It is a hard gate: a new
  sub-processor must be listed at `/subprocessors` at least 14 days before it
  receives customer data. No exceptions. Switching to another model from a maker
  that is already listed, through a listed gateway (Vercel AI Gateway,
  OpenRouter, Neon AI Gateway) or the maker's own listed API, adds no
  sub-processor and needs no notice. Only fix the maker's row if the swap makes
  its wording wrong.
- The Sites E2E suite (`apps/sites-e2e`) gates every production deploy. When a
  change to `apps/sites`, `apps/sites-builder` or `packages/sites-*` changes
  user-facing behaviour, update or extend its tests in the same PR; a pure
  visual change must not need test edits. Sites dashboard UI changes don't
  need E2E tests. Follow
  `apps/sites-e2e/README.md#keeping-the-suite-green`. Pull requests that
  change the Sites stack run its browser part (`sites-e2e-pr.yml`); the
  lifecycle with real Box builds runs only before a production deploy, so
  run it locally or with `gh workflow run sites-e2e.yml --ref <branch>`
  before merging a Sites backend change. A new external
  service the Sites backend calls gets an emulator in `apps/sites-e2e/emulators`
  and an override in `packages/sites-server/src/utils/provider-urls.ts`.
- Before adding or changing a Notra Sites analytics integration, read and apply
  `.agents/skills/sites-analytics-integration/SKILL.md`, which covers the typed
  `blog.json` options, c15t loading, CSP, dashboard translations, E2E emulators
  and docs that every provider needs.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
