import { existsSync } from "node:fs";
import { appendFile, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = "apps/blog/public";
const areas = [
  { dir: "apps/blog/blog", mount: "/blog" },
  { dir: "apps/blog/changelog", mount: "/changelog" },
];
const excluded =
  /^https:\/\/(x\.com|demo\.usenotra\.com|claude\.ai|chatgpt\.com)\//;
const linkPattern = /(?:\]\(|href="|src=")([^)"\s]+)/g;

const links = new Map();
for (const { dir, mount } of areas) {
  if (!existsSync(dir)) {
    continue;
  }
  const base = `https://www.usenotra.com${mount}/`;
  for (const file of await readdir(dir)) {
    const text = await readFile(join(dir, file), "utf8");
    for (const [, href] of text.matchAll(linkPattern)) {
      // Entries reference public/new.webp as <mount>/new.webp, the URL it is served at.
      const asset = href.startsWith(`${mount}/`)
        ? href.slice(mount.length)
        : href;
      if (
        href.startsWith("/") &&
        (existsSync(join(publicDir, href)) ||
          existsSync(join(publicDir, asset)))
      ) {
        continue;
      }
      const url = URL.canParse(href, base) ? new URL(href, base).href : href;
      if (!(href.startsWith("#") || excluded.test(url))) {
        const source = join(dir, file);
        links.set(url, [...(links.get(url) ?? []), source]);
      }
    }
  }
}

async function check(url) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; notra-link-check)" },
    });
    return response.ok ? null : `${response.status} ${response.statusText}`;
  } catch (error) {
    return error.message;
  }
}

const failures = [];
await Promise.all(
  [...links].map(async ([url, files]) => {
    const problem = await check(url);
    if (problem) {
      failures.push(
        `- \`${url}\`: ${problem} (${[...new Set(files)].join(", ")})`
      );
    }
  })
);

const report = [
  "### Blog link checker",
  "",
  `${failures.length ? "❌" : "✅"} **${links.size - failures.length}/${links.size} valid links**`,
  ...failures.sort(),
  "",
  `[View workflow run](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID})`,
].join("\n");
await writeFile("comment.md", report);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
}
console.log(report);
process.exitCode = failures.length ? 1 : 0;
