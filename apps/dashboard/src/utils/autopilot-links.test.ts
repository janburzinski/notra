import { expect, test } from "bun:test";

import {
  applyLinkSpots,
  findLinkSpots,
  pickLinkTargets,
  selectLinks,
  spotPhrase,
} from "@/utils/autopilot-links";

const SITE = "https://www.emberline.dev";

const row = (
  query: string,
  page: string,
  position: number,
  impressions = 200
) => ({ query, page: `${SITE}${page}`, clicks: 3, impressions, position });

test("targets are pages ranking 4 to 20, without brand or single-word queries", () => {
  const targets = pickLinkTargets(
    [
      row("gpu autoscaling", "/blog/gpu-autoscaling", 8, 900),
      // Already top 3: dropped on its own, the page keeps its other query.
      row("gpu cold start", "/blog/gpu-autoscaling", 2, 5000),
      row("gpu autoscaling", "/blog/old-guide", 14),
      row("serverless gpu", "/serverless", 1.5, 2000),
      row("cold start latency", "/blog/cold-starts", 42),
      row("inference", "/blog/inference", 9),
      row("emberline pricing", "/pricing", 7),
    ],
    ["Emberline"]
  );
  expect(
    targets.map((target) => [
      target.key,
      target.anchors.map((anchor) => anchor.query),
    ])
  ).toEqual([["emberline.dev/blog/gpu-autoscaling", ["gpu autoscaling"]]]);
});

const post = [
  "---",
  "description: Notes on gpu autoscaling",
  "---",
  "# GPU autoscaling for beginners",
  "",
  "This intro talks about GPU autoscaling and cold starts.",
  "",
  "Most teams overpay because GPU autoscaling is off. Cold starts are the price you pay.",
  "",
  "````md",
  "```",
  "cold starts inside an example",
  "```",
  "````",
  "",
  "Read about [private networking](/docs/networking), `cold starts` and [cold starts] here.",
  "",
  "**Cold starts:** a label, not prose.",
  "",
  "We also cover cold starts in depth.",
  "",
  "[cold starts]: https://example.com/elsewhere",
].join("\n");

test("links go in body prose, once per page and line, without changing words", () => {
  const targets = pickLinkTargets(
    [
      row("gpu autoscaling", "/blog/gpu-autoscaling", 8, 900),
      row("cold starts", "/blog/cold-starts", 12, 400),
      row("private networking", "/docs/networking", 9, 300),
    ],
    []
  );
  const spots = findLinkSpots({
    content: post,
    sourceUrl: `${SITE}/blog/serving`,
    sourcePath: "content/blog/serving.md",
    targets,
  }).map((spot, index) => ({ ...spot, id: `c${index + 1}` }));
  // Frontmatter, heading, intro, nested code, existing links of any form, bold
  // labels and the already linked page are skipped.
  expect(spots.map((spot) => [spot.line + 1, spot.text])).toEqual([
    [8, "GPU autoscaling"],
    [8, "Cold starts"],
    [20, "cold starts"],
  ]);

  // What must read on the live post to confirm it is published at its URL.
  expect(spots[0] && spotPhrase(spots[0])).toBe(
    "teams overpay because gpu autoscaling is off cold"
  );
  // Inline HTML and entities read as the page shows them.
  expect(
    spotPhrase({
      context:
        "Keep <em>one warm replica</em> for GPU autoscaling &amp; low latency on every request.",
      text: "GPU autoscaling",
    })
  ).toBe("warm replica for gpu autoscaling low latency on");

  const chosen = selectLinks(spots, new Set(["c1", "c2", "c3"]));
  expect(chosen.map((spot) => spot.id)).toEqual(["c1", "c3"]);
  const next = applyLinkSpots(post, chosen);
  expect(next).toContain(
    "Most teams overpay because [GPU autoscaling](/blog/gpu-autoscaling) is off."
  );
  expect(next.replace(/\[([^\]]+)\]\(\/blog\/[^)]+\)/g, "$1")).toBe(post);

  // CRLF files keep code blocks out the same way.
  const crlf = findLinkSpots({
    content: post.replaceAll("\n", "\r\n"),
    sourceUrl: `${SITE}/blog/serving`,
    sourcePath: "content/blog/serving.md",
    targets,
  });
  expect(crlf.map((spot) => spot.line + 1)).toEqual([8, 8, 20]);
});
