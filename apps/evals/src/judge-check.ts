import { findScenario } from "./fixtures/content-scenarios";
import {
  type CalibrationPost,
  calibrationPosts,
} from "./fixtures/judge-calibration";
import { brandReferencesFor, sourceDataFor } from "./scoring/content-post";
import {
  GROUNDED_BOOLEAN_QUESTION,
  GROUNDED_THRESHOLD,
  GROUNDING_SEVERITY_QUESTION,
  GROUNDING_SEVERITY_WEIGHTS,
  LEGACY_GROUNDED_QUESTION,
  UNSUPPORTED_COUNT_QUESTION,
} from "./scoring/grounding";
import { judgeWithJev } from "./scoring/jev-judge";
import { pad, padStart } from "./utils/charts";
import { inPool } from "./utils/pool";
import { auc, formatPct, formatUsd, mean } from "./utils/stats";

/** Headline columns use the cut the scorer applies, so a re-run shows whether it still holds. */
const THRESHOLD = GROUNDED_THRESHOLD;

const VARIANTS = {
  legacy: "old question, old context",
  legacyQuestion: "old question, new context",
  groundedBool: "boolean with rules",
  grounding: "severity choice",
  unsupportedCount: "unsupported count",
} as const;

type Variant = keyof typeof VARIANTS;

interface Sample {
  readonly post: CalibrationPost;
  readonly values: Partial<Record<Variant, number>>;
}

function legacySourceData(scenarioId: string) {
  const data = sourceDataFor(findScenario(scenarioId));
  return {
    company: data.company,
    repository: data.repository,
    lookback: data.lookback,
    commits: data.commits,
    pullRequests: data.pullRequests.map(
      ({ number, title, body, author, labels }) => ({
        number,
        title,
        body,
        author,
        labels,
      })
    ),
    releases: data.releases.map(({ tag, name, body }) => ({ tag, name, body })),
  };
}

async function judgePost(
  post: CalibrationPost,
  abortSignal: AbortSignal
): Promise<{ sample: Sample; costUsd: number }> {
  const scenario = findScenario(post.scenarioId);
  const text = `${post.title}\n${post.markdown}`;
  const [legacy, current] = await Promise.all([
    judgeWithJev({
      feature: "judge-check-legacy",
      state: { sourceData: legacySourceData(post.scenarioId), post: text },
      questions: { grounded: LEGACY_GROUNDED_QUESTION },
      abortSignal,
      demo: false,
    }),
    judgeWithJev({
      feature: "judge-check",
      state: {
        sourceData: sourceDataFor(scenario),
        brandReferences: brandReferencesFor(scenario),
        post: text,
      },
      questions: {
        legacyQuestion: LEGACY_GROUNDED_QUESTION,
        groundedBool: GROUNDED_BOOLEAN_QUESTION,
        grounding: GROUNDING_SEVERITY_QUESTION,
        unsupportedCount: UNSUPPORTED_COUNT_QUESTION,
      },
      choiceWeights: GROUNDING_SEVERITY_WEIGHTS,
      abortSignal,
      demo: false,
    }),
  ]);
  return {
    sample: {
      post,
      values: { legacy: legacy.values.grounded, ...current.values },
    },
    costUsd: (legacy.costUsd ?? 0) + (current.costUsd ?? 0),
  };
}

function errorsAt(
  grounded: readonly number[],
  ungrounded: readonly number[],
  threshold: number
) {
  return {
    falseFlags:
      grounded.filter((value) => value < threshold).length / grounded.length,
    missed:
      ungrounded.filter((value) => value >= threshold).length /
      ungrounded.length,
  };
}

/** Per-call metrics: every repeat counts on its own, as one model run would. */
function metrics(samples: readonly Sample[], variant: Variant) {
  const grounded = samples
    .filter((sample) => sample.post.grounded)
    .map((sample) => sample.values[variant] ?? 0);
  const ungrounded = samples
    .filter((sample) => !sample.post.grounded)
    .map((sample) => sample.values[variant] ?? 0);
  let best = { threshold: THRESHOLD, falseFlags: 1, missed: 1 };
  for (let step = 1; step < 100; step += 1) {
    const threshold = step / 100;
    const at = errorsAt(grounded, ungrounded, threshold);
    if (at.falseFlags + at.missed < best.falseFlags + best.missed) {
      best = { threshold, ...at };
    }
  }
  return {
    auc: auc(grounded, ungrounded),
    ...errorsAt(grounded, ungrounded, THRESHOLD),
    best,
    meanGrounded: mean(grounded),
    meanUngrounded: mean(ungrounded),
    minGrounded: Math.min(...grounded),
    maxUngrounded: Math.max(...ungrounded),
  };
}

export async function runJudgeCheck(args: {
  repeats: number;
  concurrency: number;
  verbose: boolean;
  json: boolean;
}): Promise<number> {
  const posts = calibrationPosts();
  const jobs = Array.from({ length: args.repeats }, () => posts).flat();
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  const settled = await inPool(jobs, args.concurrency, (post) =>
    judgePost(post, controller.signal).catch((error: unknown) => {
      console.error(
        `  ✗ ${post.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    })
  );
  const results = settled.filter((result) => result !== undefined);
  const failed = jobs.length - results.length;
  if (failed) {
    console.error(`${failed} judge calls failed and were skipped`);
  }
  if (!results.length) {
    console.error("No judge call succeeded, nothing to report.");
    return 1;
  }
  const samples = results.map((result) => result.sample);
  const costUsd = results.reduce((sum, result) => sum + result.costUsd, 0);
  const variants = Object.keys(VARIANTS) as Variant[];
  const report = variants.map((variant) => ({
    variant,
    ...metrics(samples, variant),
  }));

  if (args.json) {
    console.log(JSON.stringify({ failed, report, samples }, null, 2));
    return failed ? 1 : 0;
  }

  const groundedCount = posts.filter((post) => post.grounded).length;
  console.log(
    `${posts.length} labelled posts (${groundedCount} grounded, ${posts.length - groundedCount} not) × ${args.repeats} repeats, judge cost ${formatUsd(costUsd)}\n`
  );
  console.log(
    `${pad("variant", 30)}${padStart("AUC", 6)}${padStart(`flags@${THRESHOLD}`, 11)}${padStart(`missed@${THRESHOLD}`, 12)}${padStart("best cut", 10)}${padStart("flags", 8)}${padStart("missed", 8)}${padStart("min ok", 8)}${padStart("max bad", 9)}`
  );
  for (const row of report) {
    console.log(
      `${pad(VARIANTS[row.variant], 30)}${padStart(row.auc.toFixed(2), 6)}${padStart(formatPct(row.falseFlags), 11)}${padStart(formatPct(row.missed), 12)}${padStart(row.best.threshold.toFixed(2), 10)}${padStart(formatPct(row.best.falseFlags), 8)}${padStart(formatPct(row.best.missed), 8)}${padStart(row.minGrounded.toFixed(2), 8)}${padStart(row.maxUngrounded.toFixed(2), 9)}`
    );
  }
  console.log(
    "\nPer judge call. flags: grounded posts scored below the cut. missed: ungrounded posts at or above it. best cut minimises flags + missed."
  );

  if (args.verbose) {
    console.log(
      `\n${pad("post", 28)}${pad("label", 7)}${variants.map((variant) => padStart(variant.slice(0, 9), 11)).join("")}`
    );
    for (const post of posts) {
      const own = samples.filter((sample) => sample.post.id === post.id);
      const cells = variants.map((variant) =>
        padStart(
          mean(own.map((sample) => sample.values[variant] ?? 0)).toFixed(2),
          11
        )
      );
      console.log(
        `${pad(post.id, 28)}${pad(post.grounded ? "ok" : "bad", 7)}${cells.join("")}`
      );
    }
  }
  if (failed) {
    console.error(
      `\nIncomplete: ${failed} of ${jobs.length} judge calls failed, metrics cover the rest.`
    );
  }
  return failed ? 1 : 0;
}
