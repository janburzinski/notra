import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeLocalFavicons } from "../compiler/local-favicons";
import type { FaviconFetch } from "../compiler/types/build";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
let outDir = "";

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

async function write(fetcher: FaviconFetch) {
  outDir = await mkdtemp(join(tmpdir(), "notra-local-favicons-"));
  await writeLocalFavicons({
    outDir,
    mounts: ["/blog", "/changelog"],
    host: "acme.com",
    fetch: fetcher,
  });
  return Promise.all(
    ["blog", "changelog"].map((mount) =>
      readFile(join(outDir, mount, "_notra/favicon/acme.com"))
    )
  );
}

test("writes the website's favicon below every mount", async () => {
  const icon = new Uint8Array([...PNG_SIGNATURE, 1, 2, 3]);
  const files = await write(async (url) => {
    expect(String(url)).toContain("domain=acme.com");
    return new Response(icon, { headers: { "Content-Type": "image/png" } });
  });
  for (const file of files) {
    expect([...file]).toEqual([...icon]);
  }
});

test("falls back to the globe as a PNG when there's no usable favicon", async () => {
  for (const fetcher of [
    async () => new Response("missing", { status: 404 }),
    async () =>
      new Response("<html>", { headers: { "Content-Type": "text/html" } }),
    () => Promise.reject(new Error("offline")),
  ] as FaviconFetch[]) {
    const [file] = await write(fetcher);
    expect([...(file?.subarray(0, 4) ?? [])]).toEqual(PNG_SIGNATURE);
    await rm(outDir, { recursive: true, force: true });
  }
});
