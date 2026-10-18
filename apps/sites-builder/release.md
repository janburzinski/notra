# Releasing the Sites renderer

`.github/workflows/sites-dev-release.yml` publishes `@usenotra/sites-dev`, not
the public `notra` CLI. `scripts/package-cli.ts` generates the public package
from the private `@notra/sites-builder` workspace.

## How it works

Every run verifies: the Sites tests run, including `tests/packaged-dev.test.ts`,
which packs the tarball and runs it installed on Node and Bun. The verify job
uploads that exact tarball as the `sites-dev` artifact.

Only a manual run on `main` with `publish=true` publishes. The publish job
downloads the artifact, with no checkout or rebuild, and publishes it via npm
trusted publishing (OIDC) with provenance. No npm token is involved.

## One-time setup

| Where | Setting |
| --- | --- |
| GitHub | Create the `npm-sites-dev` environment, restricted to `main`, with required reviewers |
| npm | In `@usenotra/sites-dev` settings, add a GitHub Actions trusted publisher: org `usenotra`, repo `notra`, workflow `sites-dev-release.yml`, environment `npm-sites-dev` |

npm requires a new trusted publisher to complete a publish within two days, so
configure it right before a release.

If npm cannot add a trusted publisher before the package exists, an `@usenotra`
admin publishes the first version by hand:

1. Run the workflow on `main` with `publish=false` and download the `sites-dev`
   artifact.
2. `npm publish ./usenotra-sites-dev-<version>.tgz --access public`
3. Configure the trusted publisher. The next version goes through the workflow.

## Releasing a version

1. Bump `version` in `apps/sites-builder/package.json` and merge that to `main`.
   npm versions are immutable, so a version can only be published once.
2. Run **Sites dev release** on `main` with `publish=true` and approve the
   `npm-sites-dev` deployment.
3. Release the `notra` CLI with its runtime pin pointing at the new version.
