import type { ContentAgentProfile } from "@notra/ai/types/agents";

import type { ContentScenario } from "../fixtures/content-scenarios";
import type { HarnessOutput } from "../harness/content-harness";
import type { CaseScore, FieldScore, ScoreContext } from "../types/eval";
import { combineScore, gatesPassed } from "./combine";
import { GROUNDED_QUESTION, groundedField } from "./grounding";
import { judgeWithJev } from "./jev-judge";
import {
  countDashes,
  germanShare,
  metaHits,
  plainLength,
  slopHits,
  titleProblem,
} from "./text-checks";

const TWEET_MAX_CHARS = 280;
const REJECTED_CALL_REGEX =
  /Invalid input for tool |tried to call unavailable tool |InvalidToolInputError|NoSuchToolError/;
const LINKEDIN_MAX_CHARS = 1600;

const GROUNDED_WEIGHT = 3;
const MIN_COVERAGE = 0.66;
/** A tweet should lead with the main change, not fit every key fact into 280 chars. */
const MIN_TWEET_COVERAGE = 0.33;

const POST_QUESTIONS = {
  grounded: GROUNDED_QUESTION,
  coverage: {
    type: "score",
    instructions:
      "How many of keyFacts does post communicate (in any language or wording)?",
    criteria: ["None of them", "Some of them", "Most of them", "All of them"],
  },
  avoidsInternal: {
    type: "boolean",
    instructions:
      "Does post leave out every item listed in internalOnly (dependency bumps, CI changes, refactors and similar internal work)? True if none of them are mentioned.",
  },
  humanVoice: {
    type: "score",
    instructions:
      "How natural does post read for brandVoice: like a person on the team wrote it, or like generic AI marketing copy?",
    criteria: [
      "Generic AI marketing copy",
      "Mostly generic with some natural lines",
      "Natural and specific, sounds like the team",
    ],
  },
} as const;

export function sourceDataFor(scenario: ContentScenario) {
  const repositoryUrl = `https://github.com/${scenario.owner}/${scenario.repo}`;
  return {
    company: `${scenario.brand.companyName}: ${scenario.brand.companyDescription}`,
    repository: `${scenario.owner}/${scenario.repo}`,
    repositoryUrl,
    lookback: `${scenario.lookbackStartIso} to ${scenario.lookbackEndIso}`,
    commits: scenario.commits.map(
      (commit) => `${commit.sha} ${commit.message} (${commit.authorName})`
    ),
    pullRequests: scenario.pullRequests.map((pr) => ({
      number: pr.number,
      url: `${repositoryUrl}/pull/${pr.number}`,
      title: pr.title,
      body: pr.body,
      author: pr.authorLogin,
      labels: pr.labels,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
    })),
    releases: scenario.releases.map((release) => ({
      tag: release.tagName,
      url: `${repositoryUrl}/releases/tag/${release.tagName}`,
      name: release.name,
      body: release.body,
    })),
  };
}

/** House-style examples the writer was given; lines borrowed from them are style, not claims. */
export function brandReferencesFor(scenario: ContentScenario): string[] {
  return scenario.brand.references.map((reference) => reference.content);
}

function field(
  name: string,
  score: number,
  extra: Partial<FieldScore> = {}
): FieldScore {
  return { field: name, score: Math.max(0, Math.min(1, score)), ...extra };
}

function gate(
  name: string,
  ok: boolean,
  extra: Partial<FieldScore> = {}
): FieldScore {
  return field(name, ok ? 1 : 0, { ...extra, gate: true });
}

export async function scoreContentOutput(
  output: HarnessOutput,
  scenario: ContentScenario,
  contentType: ContentAgentProfile,
  ctx: ScoreContext
): Promise<CaseScore> {
  const expected = scenario.expected.decision;
  const toolErrors = (output.toolErrors ?? []).filter((error) =>
    REJECTED_CALL_REGEX.test(error)
  );
  const fields: FieldScore[] = [
    gate("decision", output.decision === expected, {
      expected,
      actual: output.decision,
      note: output.reason,
    }),
    gate("valid-tool-calls", toolErrors.length === 0, { note: toolErrors[0] }),
  ];

  const post = output.post;
  if (expected === "create" && !post) {
    fields.push(gate("saved", false, { note: "no post created" }));
  }
  if (expected === "skip" || !post) {
    return {
      score: combineScore(fields),
      pass: gatesPassed(fields) && expected === "skip",
      fields,
    };
  }

  const fullText = `${post.title}\n${post.markdown}\n${post.recommendations ?? ""}`;
  const judgedText = `${post.title}\n${post.markdown}`;
  const dashes = countDashes(fullText);
  fields.push(
    gate("no-dashes", dashes === 0, {
      note: dashes ? `${dashes} em/en dashes` : undefined,
    })
  );

  const length = plainLength(post.markdown);
  let lengthOk = length > 0;
  if (contentType.contentType === "twitter_post") {
    lengthOk = length <= TWEET_MAX_CHARS;
  } else if (contentType.contentType === "linkedin_post") {
    lengthOk = length <= LINKEDIN_MAX_CHARS;
  }
  fields.push(gate("length", lengthOk, { note: `${length} chars` }));

  const share = germanShare(post.markdown);
  const german = scenario.brand.language === "German";
  fields.push(
    gate("language", german ? share >= 0.6 : share < 0.4, {
      note: german ? `${Math.round(share * 100)}% German markers` : undefined,
    })
  );

  const badTitle = titleProblem(post.title);
  fields.push(gate("title", !badTitle, { actual: post.title, note: badTitle }));

  const meta = metaHits(judgedText);
  fields.push(
    gate("no-meta", meta.length === 0, {
      note: meta.length ? meta.join(", ") : undefined,
    })
  );

  const required =
    contentType.contentType === "twitter_post"
      ? []
      : (scenario.expected.mustMention ?? []);
  const missing = required.filter((item) => !item.pattern.test(judgedText));
  fields.push(
    gate("must-mention", missing.length === 0, {
      note: missing.length
        ? `missing: ${missing.map((item) => item.fact).join("; ")}`
        : undefined,
    })
  );

  const hits = slopHits(fullText);
  fields.push(
    field("slop", 1 - hits.length * 0.34, {
      note: hits.length ? hits.join(", ") : undefined,
    })
  );

  const verdict = await judgeWithJev({
    feature: "content-post-judge",
    state: {
      contentType: contentType.contentLabel,
      brandVoice: `${scenario.brand.companyName}: ${scenario.brand.toneProfile}${scenario.brand.customTone ? `, ${scenario.brand.customTone}` : ""}`,
      brandReferences: brandReferencesFor(scenario),
      sourceData: sourceDataFor(scenario),
      keyFacts: scenario.expected.keyFacts,
      internalOnly: scenario.expected.avoid,
      post: judgedText,
    },
    questions: POST_QUESTIONS,
    abortSignal: ctx.abortSignal,
    demo: ctx.demo,
    demoQuality: hits.length === 0 && dashes === 0 ? 0.9 : 0.6,
  });
  const grounded = groundedField(verdict.values.grounded ?? 0, GROUNDED_WEIGHT);
  const coverage = verdict.values.coverage ?? 0;
  fields.push(grounded);
  fields.push(field("coverage", coverage));
  fields.push(field("avoids-internal", verdict.values.avoidsInternal ?? 0));
  fields.push(field("human-voice", verdict.values.humanVoice ?? 0));

  const minCoverage =
    contentType.contentType === "twitter_post"
      ? MIN_TWEET_COVERAGE
      : MIN_COVERAGE;
  return {
    score: combineScore(fields),
    pass:
      gatesPassed(fields) && grounded.score === 1 && coverage >= minCoverage,
    fields,
    judgeCostUsd: verdict.costUsd,
    judgeCostSource: verdict.costSource,
  };
}
