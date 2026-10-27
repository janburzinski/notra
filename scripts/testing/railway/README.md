# Railway sandbox cleanup

This command deletes only the sandbox named in an owned Sites E2E ledger. It verifies the live project name, environment, and sandbox absence; it never uses Railway's global active-sandbox default and never deletes a project or other sandbox.

```sh
node --test scripts/testing/railway/cleanup.test.mjs
node scripts/testing/railway/cleanup.mjs /private/path/to/owned-ledger.json
```

The ledger has `projectId`, `projectName`, `environmentId`, and `sandboxId`. The exact live project name must start with `notra-sites-e2e-`. Keep ledgers outside source control, mode `0600`.

The default CLI launcher is `npx @railway/cli@5.63.4`. `SITES_E2E_RAILWAY_CLI` can point to an already installed binary. Record its actual version: the Railway CLI can auto-update itself. Configure an idle timeout at allocation as a backup, but still run this cleanup in the allocation owner's `finally` path. A killed controller also needs recovery using its saved ledger.

Project-level `railway usage projects --json` may not include experimental native sandbox charges or may report with a delay. A zero there is not proof that a sandbox run was free.
