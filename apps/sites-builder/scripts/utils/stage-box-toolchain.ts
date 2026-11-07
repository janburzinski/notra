import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { listFiles } from "../../compiler/utils/fs";
import {
  RENDER_ENTRY,
  TOOLCHAIN_ENTRIES,
  TOOLCHAIN_EXTERNALS,
  TOOLCHAIN_MANIFESTS,
  TOOLCHAIN_PACKAGE_NAME,
} from "../constants/box-snapshot";
import { toolchainLockfile } from "./toolchain-lockfile";

function bundle(root: string, entry: string, outfile: string) {
  execFileSync(
    "bun",
    [
      "--no-env-file",
      "build",
      join(root, entry),
      "--target=node",
      "--format=esm",
      `--outfile=${outfile}`,
      ...TOOLCHAIN_EXTERNALS.flatMap((name) => ["--external", name]),
    ],
    {
      cwd: root,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      stdio: "pipe",
    }
  );
}

function digest(root: string, files: string[]) {
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(relative(root, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex").slice(0, 12);
}

// Hosted builds only run `build`, so the render fingerprint covers the theme,
// the runtime dependencies at their locked versions and the build entry with
// everything it imports. A change to the dev server, the CLI's other commands,
// dev dependencies, tests or docs keeps it and does not rebuild live sites.
async function renderFingerprint(root: string, stage: string) {
  const work = mkdtempSync(join(tmpdir(), "notra-sites-render-"));
  try {
    bundle(root, RENDER_ENTRY, join(work, "dist/build.mjs"));
    for (const entry of [...TOOLCHAIN_ENTRIES, ...TOOLCHAIN_MANIFESTS]) {
      cpSync(join(stage, entry), join(work, entry), { recursive: true });
    }
    return digest(work, await listFiles(work));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export async function stageBoxToolchain(stage: string) {
  const root = resolve(import.meta.dirname, "../..");
  mkdirSync(join(stage, "dist"), { recursive: true });
  for (const entry of TOOLCHAIN_ENTRIES) {
    cpSync(join(root, entry), join(stage, entry), { recursive: true });
  }
  bundle(root, "compiler/cli.ts", join(stage, "dist/cli.mjs"));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  // The Box runs `npm ci`, so it installs exactly what bun.lock resolved.
  const { lockfile, overrides } = toolchainLockfile(
    resolve(root, "../.."),
    pkg.name,
    pkg.dependencies
  );
  writeFileSync(
    join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: TOOLCHAIN_PACKAGE_NAME,
        private: true,
        type: "module",
        dependencies: pkg.dependencies,
        ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(stage, "package-lock.json"),
    `${JSON.stringify(lockfile, null, 2)}\n`
  );
  const fingerprint = await renderFingerprint(root, stage);
  writeFileSync(join(stage, "RENDER_FINGERPRINT"), `${fingerprint}\n`);
  const version = digest(stage, await listFiles(stage));
  writeFileSync(join(stage, "VERSION"), `${version}\n`);
  return { version, renderFingerprint: fingerprint };
}
