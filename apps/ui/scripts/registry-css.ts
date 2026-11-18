/**
 * Copies stylesheets from packages/ui/src/styles into the `css` of the
 * registry items built on them, so installs get the dashboard's rules and
 * the stylesheet stays the one source of truth.
 *
 *   bun scripts/registry-css.ts          rewrite registry.json
 *   bun scripts/registry-css.ts --check  fail if registry.json is stale
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Registry item name → stylesheet in packages/ui/src/styles. */
const SOURCES: Record<string, string> = {
  "edge-light": "edge-light.css",
};

type CssTree = { [key: string]: string | CssTree };
type Registry = { items: { name: string; css?: CssTree }[] };

const REGISTRY_PATH = fileURLToPath(
  new URL("../registry.json", import.meta.url)
);

/**
 * Parses a stylesheet into the nested object shadcn's `css` field takes.
 * Handles comments, nested rules and at-rules; values must not contain
 * braces, semicolons or strings, which holds for these stylesheets.
 */
function parse(css: string): CssTree {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let index = 0;

  function block(): CssTree {
    const tree: CssTree = {};
    let buffer = "";
    while (index < source.length) {
      const char = source[index++];
      if (char === "{") {
        const key = buffer.replace(/\s+/g, " ").trim();
        buffer = "";
        const body = block();
        const existing = tree[key];
        tree[key] =
          typeof existing === "object" ? { ...existing, ...body } : body;
      } else if (char === "}") {
        break;
      } else if (char === ";") {
        declare(tree, buffer);
        buffer = "";
      } else {
        buffer += char;
      }
    }
    declare(tree, buffer);
    return tree;
  }

  function declare(tree: CssTree, text: string) {
    const declaration = text.trim();
    if (!declaration) {
      return;
    }
    const colon = declaration.indexOf(":");
    if (colon === -1) {
      throw new Error(`Not a declaration: ${declaration}`);
    }
    tree[declaration.slice(0, colon).trim()] = declaration
      .slice(colon + 1)
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .trim();
  }

  return block();
}

const registry: Registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
const stale: string[] = [];

for (const [name, file] of Object.entries(SOURCES)) {
  const item = registry.items.find((entry) => entry.name === name);
  if (!item) {
    throw new Error(`registry.json has no item named ${name}`);
  }
  const path = fileURLToPath(
    new URL(`../../../packages/ui/src/styles/${file}`, import.meta.url)
  );
  const css = parse(await readFile(path, "utf8"));
  if (JSON.stringify(css) !== JSON.stringify(item.css)) {
    stale.push(`${name} <- packages/ui/src/styles/${file}`);
    item.css = css;
  }
}

if (process.argv.includes("--check")) {
  if (stale.length > 0) {
    console.error(
      `registry.json css differs from the stylesheets. Run \`bun run --filter=ui registry:css\`.\n${stale.join("\n")}`
    );
    process.exit(1);
  }
  console.log("registry.json css matches the stylesheets");
} else if (stale.length > 0) {
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  const format = spawnSync("bunx", ["--no-install", "oxfmt", REGISTRY_PATH], {
    stdio: "inherit",
  });
  if (format.status !== 0) {
    process.exit(format.status ?? 1);
  }
  console.log(`Updated css:\n${stale.join("\n")}`);
} else {
  console.log("registry.json css already matches the stylesheets");
}
