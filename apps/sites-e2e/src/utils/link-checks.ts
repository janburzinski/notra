import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { SiteBuildRequest } from "@notra/sites-core/types/build";

import { brokenLinkDiagnostics } from "../../../../packages/sites-compiler/src/links";
import type { SiteContentLink } from "../../../../packages/sites-compiler/src/types/links";
import { listFiles } from "../../../sites-builder/compiler/utils/fs";
import { htmlIds } from "../../../sites-builder/compiler/utils/html-ids";

const run = promisify(execFile);

const BROKEN_POST = `---
title: Broken links
date: 2026-10-03
---

## Real heading

[Gone](/blog/2026/lanch) [Typo anchor](#real-headng) [Bad escape](/blog/100%) [Tag](/blog/tags/nope)

![Missing](/images/e2e-smal-photo.jpg)

<img srcSet="data:image/png;base64,AAAA 1x, /images/e2e-small-photo.jpg?v=1,2 2x, /images/e2e-gone.png 3x" alt="" />
`;

/**
 * Fragments are checked against the IDs on the built page, so a link to one
 * that isn't there must warn, also when the ID only sits in a comment or a
 * <template>. Checked on the fixture's real output, since the fixture's own
 * links all have to pass.
 */
function assertBrokenAnchorsWarn(
  files: ReadonlySet<string>,
  html: ReadonlyMap<string, string>,
  target: SiteBuildRequest
) {
  for (const [file, id] of [
    ["/blog/components/index.html", "e2e-template-only"],
    ["/blog/hello-world/index.html", "e2e-comment-only"],
  ] as const) {
    assert.ok(html.get(file)?.includes(`id="${id}"`), `${file} has ${id}`);
  }
  const post = { area: "blog" as const, slug: "components", draft: false };
  const link = (url: string, file = "blog/components.mdx"): SiteContentLink =>
    file === "blog/components.mdx"
      ? { file, pages: [post], shared: false, url, kind: "link", line: 1 }
      : {
          file,
          pages: [{ area: "blog" }],
          shared: true,
          url,
          kind: "link",
          line: 1,
        };
  const authorHero: SiteContentLink = {
    file: "slots/author-hero.mdx",
    pages: [{ area: "blog", under: "author" }],
    shared: true,
    url: "/blog/e2e-no-such-post",
    kind: "link",
    line: 1,
  };
  const check = (built: ReadonlySet<string>) =>
    brokenLinkDiagnostics(
      [
        link("#e2e-link-targts"),
        link("#e2e-template-only"),
        link("/blog/hello-world#e2e-comment-only"),
        link("/blog/calm-software#ship-small:~:text=Small"),
        link("/blog/calm-software#:~:text=Small"),
        link("/blog/calm-software#ship-smal", "footer.mdx"),
        // A footer is on every page, so a fragment alone depends on the page.
        link("#e2e-anywhere", "footer.mdx"),
        authorHero,
      ],
      {
        mounts: target.mounts,
        publicOrigin: target.publicOrigin,
        files: built,
        publicFiles: new Set(),
        redirects: [],
        ids: (file) => {
          const page = html.get(file);
          return page === undefined ? null : htmlIds(page);
        },
      }
    ).map((item) => `${item.file} ${item.code}: ${item.message}`);
  const anchors = [
    'blog/components.mdx link_broken: Broken link to #e2e-link-targts: /blog/components has no heading or other element with id "e2e-link-targts". Did you mean #e2e-link-targets?',
    'blog/components.mdx link_broken: Broken link to #e2e-template-only: /blog/components has no heading or other element with id "e2e-template-only".',
    'blog/components.mdx link_broken: Broken link to /blog/hello-world#e2e-comment-only: /blog/hello-world has no heading or other element with id "e2e-comment-only".',
    'footer.mdx link_broken: Broken link to /blog/calm-software#ship-smal: /blog/calm-software has no heading or other element with id "ship-smal". Did you mean #ship-small?',
  ];
  assert.deepEqual(check(files), [
    ...anchors,
    "slots/author-hero.mdx link_broken: Broken link to /blog/e2e-no-such-post: no page, file or redirect has this path.",
  ]);
  // Without author pages the author-hero slot isn't shown anywhere.
  assert.deepEqual(
    check(
      new Set([...files].filter((file) => !file.startsWith("/blog/author/")))
    ),
    anchors
  );
}

async function validate(builder: string, source: string) {
  const { stdout } = await run(
    process.execPath,
    [
      "--no-env-file",
      join(builder, "compiler/cli.ts"),
      "validate",
      "--source",
      source,
      "--mount",
      "blog=/blog",
      "--mount",
      "changelog=/changelog",
      "--json",
    ],
    { cwd: builder }
  );
  const result = JSON.parse(stdout) as {
    ok: boolean;
    diagnostics: { file: string; code: string; message: string }[];
  };
  assert.equal(result.ok, true, stdout);
  return result.diagnostics
    .filter(
      (item) => item.code === "link_broken" || item.code === "image_missing"
    )
    .map((item) => `${item.file} ${item.code}: ${item.message}`);
}

/**
 * `notra-sites validate` checks what it can without building and never warns
 * about a link the build accepts: the fixture passes, and of an E2E-only
 * post's broken links it reports all but the ones only a build can see. The
 * author-hero slot waits for the build, which knows if there are author pages.
 */
async function assertValidateChecksLinks(builder: string, source: string) {
  assert.deepEqual(await validate(builder, source), []);
  const post = join(source, "blog/e2e-broken-links.mdx");
  const authorHero = join(source, "slots/author-hero.mdx");
  const slot = await readFile(authorHero, "utf8");
  await writeFile(post, BROKEN_POST);
  await writeFile(
    authorHero,
    `${slot}\n<a href="/blog/e2e-no-such-post">Gone</a>\n`
  );
  try {
    assert.deepEqual(await validate(builder, source), [
      "blog/e2e-broken-links.mdx link_broken: Broken link to /blog/2026/lanch: no page, file or redirect has this path. Did you mean /blog/2026/launch?",
      "blog/e2e-broken-links.mdx link_broken: Broken link to /blog/100%: Notra can't read this path and answers it with 400 Bad Request. Write % as %25 and leave out .. segments.",
      "blog/e2e-broken-links.mdx image_missing: Missing image /images/e2e-smal-photo.jpg: there is no public/images/e2e-smal-photo.jpg in the repository. Did you mean /images/e2e-small-photo.jpg?",
      "blog/e2e-broken-links.mdx image_missing: Missing image /images/e2e-gone.png: there is no public/images/e2e-gone.png in the repository.",
    ]);
  } finally {
    await rm(post);
    await writeFile(authorHero, slot);
  }
}

export async function assertLinkChecks(
  builder: string,
  source: string,
  outDir: string,
  target: SiteBuildRequest
) {
  const files = new Set<string>();
  const html = new Map<string, string>();
  for (const file of await listFiles(outDir)) {
    const path = file.slice(outDir.length);
    files.add(path);
    if (path.endsWith(".html")) {
      html.set(path, await readFile(file, "utf8"));
    }
  }
  assertBrokenAnchorsWarn(files, html, target);
  await assertValidateChecksLinks(builder, source);
}
