import { copyFileSync, existsSync, globSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const wasm = createRequire(require.resolve("satori")).resolve(
  "harfbuzzjs/hb.wasm"
);

for (const hb of globSync("{.output,.vercel/output}/**/harfbuzzjs/hb.js")) {
  const target = join(dirname(hb), "hb.wasm");
  if (!existsSync(target)) {
    copyFileSync(wasm, target);
  }
}
