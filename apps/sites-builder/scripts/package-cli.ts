import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dir, "..");
const destination = resolve(root, ".notra", "package");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const astro = JSON.parse(
  await readFile(
    fileURLToPath(import.meta.resolve("astro/package.json")),
    "utf8"
  )
);

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await Promise.all([
  ...["astro.config.mjs", "src", "dist"].map((entry) =>
    cp(resolve(root, entry), resolve(destination, entry), { recursive: true })
  ),
  cp(resolve(root, "../../LICENSE"), resolve(destination, "LICENSE")),
  cp(resolve(root, "README.md"), resolve(destination, "README.md")),
]);
await writeFile(
  resolve(destination, "package.json"),
  `${JSON.stringify(
    {
      name: "@usenotra/sites-dev",
      version: pkg.version,
      description:
        "Local Notra Sites previews, using the hosted site's renderer.",
      type: "module",
      license: "AGPL-3.0-only",
      repository: {
        type: "git",
        url: "https://github.com/usenotra",
      },
      bin: { "notra-sites": "./dist/cli.mjs" },
      files: ["astro.config.mjs", "src", "dist", "LICENSE", "README.md"],
      engines: astro.engines,
      dependencies: pkg.dependencies,
      publishConfig: { access: "public" },
    },
    null,
    2
  )}\n`
);
execFileSync("npm", ["pack", "--pack-destination", resolve(root, ".notra")], {
  cwd: destination,
  stdio: "inherit",
});
