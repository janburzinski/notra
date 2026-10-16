# Console

Next.js companion/admin app on port 3003, imported from `usenotra/notra-console`
at `c868f26`. The dashboard and website remain TanStack Start apps.

- Use the root Bun workspace, lockfile, lint/format configuration, and Git hooks.
- Run tasks from the monorepo root with `bun run <task> --filter=console`.
- Configure shared secrets in the root `.env`; see `.env.example` here for the
  console's requirements. Never copy production credentials for verification.
- Keep `CONSOLE_APP_URL` and `CONSOLE_WORKOS_REDIRECT_URI` separate from the
  dashboard URLs. Register the console callback in WorkOS.
- Database migrations are owned by `packages/db`, never this app.
- Use `@notra/db` for all schema and database access, `@notra/ai` for MCP,
  encryption, uploads and skill seeding, and `@notra/ui` for UI primitives,
  styles, hooks and dialogs. Do not reintroduce app-local copies.
- Store listing review/curation lives in `@notra/ai/integrations/mcp-store-admin`;
  public catalog reads live in `@notra/ai/integrations/mcp-store`.
- Next-specific AuthKit actions and login/verification flow adapters remain in
  this app; their visual primitives come from `@notra/ui`.
- Read the installed `next/dist/docs/` guides before changing framework code.
