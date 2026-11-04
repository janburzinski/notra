import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import {
  brotliCompressSync,
  brotliDecompressSync,
  constants,
  gunzipSync,
  gzipSync,
} from "node:zlib";

const root = new URL("../../", import.meta.url);
const publicDir = new URL("apps/web/.output/public/assets/", root);
const files = await readdir(publicDir);
const samples = [];
for (const extension of [".js", ".css"]) {
  const candidates = await Promise.all(
    files
      .filter((file) => file.endsWith(extension))
      .map(async (file) => ({
        file,
        bytes: (await stat(new URL(file, publicDir))).size,
      }))
  );
  candidates.sort((a, b) => b.bytes - a.bytes);
  if (!candidates[0]) {
    throw new Error(`Build website first: missing ${extension}`);
  }
  samples.push({
    name: candidates[0].file,
    data: await readFile(new URL(candidates[0].file, publicDir)),
  });
}
samples.push({
  name: "public-report-json",
  data: await readFile(
    new URL(
      "apps/web/src/content/state-of-ai-search/postgres/2026-10.json",
      root
    )
  ),
});
samples.push({
  name: "logo.svg",
  data: await readFile(new URL("apps/web/public/logo.svg", root)),
});
if (process.argv[2]) {
  samples.splice(0, samples.length, {
    name: "provided-local-file",
    data: await readFile(process.argv[2]),
  });
}
const results = [];
for (const sample of samples) {
  for (const [algorithm, level] of [
    ["gzip", 1],
    ["gzip", 6],
    ["gzip", 9],
    ["br", 4],
    ["br", 6],
    ["br", 11],
  ]) {
    const encode =
      algorithm === "gzip"
        ? () => gzipSync(sample.data, { level })
        : () =>
            brotliCompressSync(sample.data, {
              params: { [constants.BROTLI_PARAM_QUALITY]: level },
            });
    const decode = algorithm === "gzip" ? gunzipSync : brotliDecompressSync;
    for (let i = 0; i < 3; i++) {
      encode();
    }
    const timings = [];
    let output;
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      output = encode();
      timings.push(performance.now() - start);
    }
    if (!decode(output).equals(sample.data)) {
      throw new Error("Roundtrip failed");
    }
    timings.sort((a, b) => a - b);
    results.push({
      sample: sample.name,
      sha256: createHash("sha256").update(sample.data).digest("hex"),
      rawBytes: sample.data.length,
      algorithm,
      level,
      bytes: output.length,
      savedPercent: +(100 * (1 - output.length / sample.data.length)).toFixed(
        2
      ),
      medianMs: +timings[7].toFixed(3),
      p95Ms: +timings[14].toFixed(3),
      runs: timings.length,
    });
  }
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      zlib: process.versions.zlib,
      brotli: process.versions.brotli,
      cpu: cpus()[0].model,
      results,
    },
    null,
    2
  )
);
