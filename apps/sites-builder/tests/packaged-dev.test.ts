import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { findFreePort } from "../compiler/dev-server";

const toolchain = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(
  await readFile(join(toolchain, "package.json"), "utf8")
);
// CI uploads and publishes this exact file, so nothing may rebuild it later.
const archive = join(toolchain, ".notra", `usenotra-sites-dev-${version}.tgz`);

const packed = Bun.spawnSync([process.execPath, "run", "package:cli"], {
  cwd: toolchain,
  stdout: "pipe",
  stderr: "pipe",
});
if (packed.exitCode !== 0) {
  throw new Error(`package:cli failed:\n${packed.stderr.toString()}`);
}

// Both run the tarball installed outside the checkout. Node runs the CLI
// directly because the npx wrapper does not forward SIGINT on Linux.
const launchers = {
  bun: async () => [
    process.execPath,
    "x",
    "--bun",
    "--package",
    archive,
    "notra-sites",
  ],
  node: async (root: string) => {
    const consumer = join(root, "consumer");
    await mkdir(consumer);
    await writeFile(join(consumer, "package.json"), '{"private":true}\n');
    const installed = Bun.spawnSync(
      [
        "npm",
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        archive,
      ],
      { cwd: consumer, stdout: "pipe", stderr: "pipe" }
    );
    if (installed.exitCode !== 0) {
      throw new Error(`npm install failed:\n${installed.stderr.toString()}`);
    }
    return [
      "node",
      join(consumer, "node_modules/@usenotra/sites-dev/dist/cli.mjs"),
    ];
  },
};

test("the packed manifest is publishable", async () => {
  const manifest = JSON.parse(
    await readFile(join(toolchain, ".notra", "package", "package.json"), "utf8")
  );
  expect(manifest.name).toBe("@usenotra/sites-dev");
  expect(manifest.license).toBe("AGPL-3.0-only");
  expect(manifest.private).toBeUndefined();
  expect(manifest.bin["notra-sites"]).toBe("./dist/cli.mjs");
  expect(manifest.publishConfig.access).toBe("public");
  for (const range of Object.values<string>(manifest.dependencies)) {
    expect(range).not.toMatch(/^(workspace|file|link):/);
  }
});

test.each(Object.keys(launchers) as (keyof typeof launchers)[])(
  "the installed package hot-reloads content and config on %s",
  async (runtime) => {
    const root = await mkdtemp(join(tmpdir(), "notra-packaged-dev-test-"));
    let output = "";
    let child: ReturnType<typeof Bun.spawn> | undefined;
    try {
      const source = join(root, "customer site");
      await mkdir(join(source, "blog"), { recursive: true });
      const post = join(source, "blog", "hello.mdx");
      await writeFile(
        post,
        '---\ntitle: "Original post"\ndate: 2026-10-12\n---\n\nOriginal content.\n'
      );
      const port = await findFreePort(19000);
      child = Bun.spawn(
        [
          ...(await launchers[runtime](root)),
          "dev",
          "--source",
          source,
          "--port",
          String(port),
        ],
        { cwd: source, stdout: "pipe", stderr: "pipe" }
      );
      const drain = async (stream: ReadableStream<Uint8Array>) => {
        for await (const chunk of stream) {
          output += new TextDecoder().decode(chunk);
        }
      };
      const drained = Promise.all([
        drain(child.stdout as ReadableStream<Uint8Array>),
        drain(child.stderr as ReadableStream<Uint8Array>),
      ]);
      const waitForPage = async (text: string, slug = "hello") => {
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          if (child?.exitCode !== null) {
            throw new Error(`Preview exited early:\n${output}`);
          }
          const response = await fetch(
            `http://127.0.0.1:${port}/blog/${slug}`,
            { signal: AbortSignal.timeout(2000) }
          ).catch(() => null);
          if (response?.ok && (await response.text()).includes(text)) {
            return;
          }
          await Bun.sleep(200);
        }
        throw new Error(`Preview never rendered ${text}:\n${output}`);
      };
      await waitForPage("Original content.");
      const markdown = await fetch(`http://127.0.0.1:${port}/blog/hello.md`);
      expect(markdown.status).toBe(200);
      expect(markdown.headers.get("content-type")).toContain("text/markdown");
      expect(await markdown.text()).toContain("# Original post");
      await writeFile(
        post,
        '---\ntitle: "Updated post"\ndate: 2026-10-12\n---\n\nUpdated content.\n'
      );
      await waitForPage("Updated content.");
      expect(
        await (await fetch(`http://127.0.0.1:${port}/blog/hello.md`)).text()
      ).toContain("Updated content.");
      await writeFile(
        join(source, "blog.json"),
        JSON.stringify({ name: "Updated site name" })
      );
      await waitForPage("Updated site name");
      await mkdir(join(source, "snippets"));
      await writeFile(
        join(source, "snippets", "counter.jsx"),
        "export const Counter = () => { const [count, setCount] = useState(0); return <button onClick={() => setCount(count + 1)}>Counter: {count}</button>; };"
      );
      await writeFile(
        join(source, "blog", "counter.mdx"),
        '---\ntitle: "Interactive component"\ndate: 2026-10-12\n---\n\nimport { Counter } from "/snippets/counter.jsx";\n\n<Counter />\n'
      );
      await waitForPage("Counter:", "counter");
      child.kill("SIGINT");
      expect(
        await Promise.race([child.exited, Bun.sleep(10_000).then(() => -1)])
      ).toBe(0);
      await drained;
      expect(
        await fetch(`http://127.0.0.1:${port}/blog/hello`).catch(() => null)
      ).toBeNull();
    } finally {
      if (child?.exitCode === null) {
        child.kill("SIGTERM");
        await child.exited;
      }
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000
);
