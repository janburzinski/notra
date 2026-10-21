import { cpSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
// Bun installs resvg and its platform-specific native binding in this scope.
const scope = dirname(dirname(require.resolve("@resvg/resvg-js/package.json")));
cpSync(scope, new URL("../dist/node_modules/@resvg", import.meta.url), {
  recursive: true,
  dereference: true,
});
