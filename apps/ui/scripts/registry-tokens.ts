/**
 * Copies Notra token values from packages/ui/src/styles/{tokens,typography}.css
 * into the cssVars of every registry item that declares them, so installed
 * components get the same palette and type as the dashboard.
 *
 *   bun scripts/registry-tokens.ts          rewrite registry.json
 *   bun scripts/registry-tokens.ts --check  fail if registry.json is stale
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type Mode = "light" | "dark" | "theme";
type CssVars = Partial<Record<Mode, Record<string, string>>>;
type Registry = { items: { name: string; cssVars?: CssVars }[] };

const TOKEN_PATHS = ["tokens.css", "typography.css"].map((file) =>
  fileURLToPath(
    new URL(`../../../packages/ui/src/styles/${file}`, import.meta.url)
  )
);
const REGISTRY_PATH = fileURLToPath(
  new URL("../registry.json", import.meta.url)
);
const MODES: Mode[] = ["light", "dark", "theme"];

/** Every `--name: value` in the blocks that match `selector`, merged. */
function readBlocks(css: string, selector: RegExp): Record<string, string> {
  const vars: Record<string, string> = {};
  const blocks = [...css.matchAll(selector)];
  if (blocks.length === 0) {
    throw new Error(`No token block matches ${selector}`);
  }
  for (const [, body = ""] of blocks) {
    for (const [, name, value] of body.matchAll(
      /--([a-z0-9-]+)\s*:\s*([^;]+);/g
    )) {
      if (name && value) {
        vars[name] = value.replace(/\s+/g, " ").trim();
      }
    }
  }
  return vars;
}

const css = (
  await Promise.all(TOKEN_PATHS.map((path) => readFile(path, "utf8")))
)
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const light = readBlocks(css, /:root\s*\{([^}]*)\}/g);
// Dark only lists what changes, the brand palette carries over from :root.
const dark = {
  ...light,
  ...readBlocks(css, /\.dark,\s*\[data-theme="dark"\]\s*\{([^}]*)\}/g),
};
const theme = readBlocks(css, /@theme inline\s*\{([^}]*)\}/g);

/** A theme value with mode-independent `var()`s replaced, for installs that lack them. */
function resolve(value: string): string {
  return value.replace(/var\(--([a-z0-9-]+)\)/g, (ref, name: string) =>
    light[name] !== undefined && light[name] === dark[name]
      ? resolve(light[name])
      : ref
  );
}

const tokens: Record<Mode, Record<string, string>> = { light, dark, theme };

const registry: Registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
const stale: string[] = [];

for (const item of registry.items) {
  for (const mode of MODES) {
    const vars = item.cssVars?.[mode];
    if (!vars) {
      continue;
    }
    for (const [name, value] of Object.entries(vars)) {
      const raw = tokens[mode][name];
      if (raw === undefined) {
        continue;
      }
      // Theme entries may point at a light/dark var or carry the value itself.
      const token =
        mode === "theme" && !value.startsWith("var(") ? resolve(raw) : raw;
      if (token !== value) {
        stale.push(`${item.name} ${mode} --${name}: ${value} -> ${token}`);
        vars[name] = token;
      }
    }
  }
}

if (process.argv.includes("--check")) {
  if (stale.length > 0) {
    console.error(
      `registry.json cssVars differ from the token files. Run \`bun run --filter=ui registry:tokens\`.\n${stale.join("\n")}`
    );
    process.exit(1);
  }
  console.log("registry.json cssVars match the token files");
} else if (stale.length > 0) {
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  const format = spawnSync("bunx", ["--no-install", "oxfmt", REGISTRY_PATH], {
    stdio: "inherit",
  });
  if (format.status !== 0) {
    process.exit(format.status ?? 1);
  }
  console.log(`Updated ${stale.length} cssVars:\n${stale.join("\n")}`);
} else {
  console.log("registry.json cssVars already match the token files");
}
