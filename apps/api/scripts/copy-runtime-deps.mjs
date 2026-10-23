import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { traceNodeModules } from "nf3";

const require = createRequire(import.meta.url);
// Sharp has separate ESM and CommonJS entries; the server and smoke check use both.
await traceNodeModules(
  [
    require.resolve("@resvg/resvg-js"),
    require.resolve("sharp"),
    fileURLToPath(import.meta.resolve("sharp")),
    require.resolve("wawoff2"),
  ],
  { outDir: fileURLToPath(new URL("../dist", import.meta.url)) }
);
