import { isDeepStrictEqual } from "node:util";

import { CHAT_MODEL_ID } from "@notra/ai/constants/models";
import {
  createArtifactInputSchema,
  getArtifactInputSchema,
  updateArtifactInputSchema,
} from "@notra/ai/schemas/artifact";
import { ARTIFACT_TOOL_GUIDE } from "@notra/ai/tools/artifacts";
import type { ArtifactContent } from "@notra/ai/types/artifact";
import {
  parseArtifactFile,
  serializeArtifactFile,
} from "@notra/ai/utils/artifact-file";
import { generateText, type ModelMessage, tool } from "ai";
import * as z from "zod";

import {
  ARTIFACT_REPORT,
  ARTIFACT_TRAFFIC_DATA,
  type ArtifactBlockOf,
} from "../fixtures/artifact-scenarios";
import { getGateway, runCostDetails, toUsage } from "../models/gateway";
import type { EvalCase, EvalSuite, FieldScore } from "../types/eval";

interface ArtifactInput {
  mode: "edit" | "create";
  ask: string;
}

interface ArtifactOutput {
  content: ArtifactContent | null;
  /** Why the last attempt saved nothing. */
  error: string | null;
  attempts: number;
}

/** What the change must be, and that nothing else moved. null passes. */
type ArtifactCheck = (after: ArtifactContent) => string | null;

const REPORT = ARTIFACT_REPORT;
const FILE = serializeArtifactFile(REPORT);
/** Like the chat: one failed save comes back as an error the model can fix. */
const ATTEMPTS = 2;

const block = <T extends ArtifactContent["blocks"][number]["type"]>(
  after: ArtifactContent,
  index: number,
  type: T
) => {
  const found = after.blocks[index];
  return found?.type === type ? (found as ArtifactBlockOf<T>) : null;
};
const sameMeta = (after: ArtifactContent) =>
  after.title === REPORT.title && after.summary === REPORT.summary
    ? null
    : "title or summary changed";
/** The summary may follow a changed headline number; nothing else may move. */
const othersKept = (
  after: ArtifactContent,
  changed: number,
  summaryMayChange = false
) => {
  if (
    !isDeepStrictEqual(
      REPORT.blocks.filter((_, index) => index !== changed),
      after.blocks.filter((_, index) => index !== changed)
    )
  ) {
    return "other blocks changed";
  }
  if (summaryMayChange) {
    return after.title === REPORT.title && after.summary
      ? null
      : "title changed or summary dropped";
  }
  return sameMeta(after);
};
const table = REPORT.blocks[3] as ArtifactBlockOf<"table">;
const metrics = REPORT.blocks[0] as ArtifactBlockOf<"metrics">;
const asNumber = (cell: unknown) =>
  typeof cell === "string" && /^[\d,]+$/.test(cell)
    ? Number(cell.replace(/,/g, ""))
    : cell;

const CHECKS: Record<string, ArtifactCheck> = {
  typo(after) {
    const text = block(after, 1, "text");
    const want = (REPORT.blocks[1] as ArtifactBlockOf<"text">).markdown.replace(
      "Refferals",
      "Referrals"
    );
    return text?.markdown === want
      ? othersKept(after, 1)
      : "typo not fixed exactly";
  },
  metric(after) {
    const items = block(after, 0, "metrics")?.items;
    const want = [
      { ...metrics.items[0], value: "13.1k", change: "+22%" },
      ...metrics.items.slice(1),
    ];
    return isDeepStrictEqual(items, want)
      ? othersKept(after, 0, true)
      : "metrics wrong";
  },
  "add-row"(after) {
    const rows = block(after, 3, "table")?.rows.map((row) => row.map(asNumber));
    const want = [
      ...table.rows.slice(0, 3),
      ["Mistral", 310, "+12%", "2.5%"],
      ...table.rows.slice(3),
    ];
    return isDeepStrictEqual(rows, want) ? othersKept(after, 3) : "rows wrong";
  },
  "fix-cells"(after) {
    const rows = block(after, 3, "table")?.rows.map((row) => row.map(asNumber));
    const want = table.rows.map((row) =>
      row[0] === "Claude" ? ["Claude", 2450, "+110%", "17%"] : row
    );
    return isDeepStrictEqual(rows, want) ? othersKept(after, 3) : "rows wrong";
  },
  "remove-callout"(after) {
    const want = REPORT.blocks.filter((item) => item.type !== "callout");
    return isDeepStrictEqual(after.blocks, want)
      ? sameMeta(after)
      : "blocks wrong";
  },
  "insert-paragraph"(after) {
    const added = block(after, 3, "text");
    if (!(added && /claude/i.test(added.markdown))) {
      return "no paragraph after the chart";
    }
    const rest = after.blocks.filter((_, index) => index !== 3);
    return isDeepStrictEqual(rest, REPORT.blocks)
      ? sameMeta(after)
      : "other blocks changed";
  },
  retitle(after) {
    if (after.title !== "AI traffic, week 46") {
      return "title wrong";
    }
    if (!after.summary?.includes("18%")) {
      return "summary wrong";
    }
    return isDeepStrictEqual(after.blocks, REPORT.blocks)
      ? null
      : "blocks changed";
  },
  "create-report"(after) {
    const types = after.blocks.map((item) => item.type);
    const chart = after.blocks.find((item) => item.type === "chart");
    const rows = after.blocks.find((item) => item.type === "table");
    if (!types.includes("metrics")) {
      return "no metrics";
    }
    if (chart?.type !== "chart" || chart.chart.kind !== "area") {
      return "no area chart";
    }
    if (chart.chart.series.length !== 2) {
      return "chart needs ChatGPT and Claude";
    }
    return rows?.type === "table" && rows.rows.length === 7
      ? null
      : "table needs every source";
  },
  "create-bar"(after) {
    const chart = after.blocks.find((item) => item.type === "chart");
    if (chart?.type !== "chart" || chart.chart.kind !== "bar") {
      return "no bar chart";
    }
    if (chart.chart.segments.length < 5) {
      return "bar chart misses sources";
    }
    return after.blocks.some((item) => item.type === "callout")
      ? null
      : "no Gemini warning";
  },
};

const CASES: EvalCase<ArtifactInput, { check: string }>[] = [
  ["typo", "Fix the typo 'Refferals' in the What changed section."],
  ["metric", "Visits were actually 13.1k, up 22%. Update that metric."],
  [
    "add-row",
    "Add Mistral to the source table: 310 visits, +12%, 2.5% share. Put it after Perplexity.",
  ],
  [
    "fix-cells",
    "Claude's numbers in the table are wrong: 2,450 visits and +110%.",
  ],
  ["remove-callout", "Remove the Gemini callout."],
  [
    "insert-paragraph",
    "Right after the chart, add one short paragraph saying Claude traffic doubled week over week.",
  ],
  [
    "retitle",
    "Rename it to 'AI traffic, week 46' and make the summary say referrals grew 18%, led by ChatGPT.",
  ],
].map(([id = "", ask = ""]) => ({
  id,
  title: `Edit: ${ask}`,
  input: { mode: "edit" as const, ask },
  expected: { check: id },
}));

CASES.push(
  {
    id: "create-report",
    title: "Create: report with metrics, area chart and source table",
    input: {
      mode: "create",
      ask: "Make me a report of last week's AI traffic with the headline numbers, a chart of daily ChatGPT vs Claude visits and a table by source.",
    },
    expected: { check: "create-report" },
  },
  {
    id: "create-bar",
    title: "Create: bar chart by source and a warning",
    input: {
      mode: "create",
      ask: "Build a report on AI referrals: the totals, a bar chart of visits by source, and a warning about Gemini falling.",
    },
    expected: { check: "create-bar" },
  }
);

function history(input: ArtifactInput): ModelMessage[] {
  const read =
    input.mode === "edit"
      ? {
          name: "getArtifact",
          ask: "Open the weekly AI traffic artifact.",
          value: { artifactId: "a1", version: 3, content: FILE },
        }
      : {
          name: "getTraffic",
          ask: input.ask,
          value: ARTIFACT_TRAFFIC_DATA,
        };
  return [
    { role: "user", content: read.ask },
    {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "read",
          toolName: read.name,
          input: {},
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "read",
          toolName: read.name,
          output: { type: "json", value: read.value },
        },
      ],
    },
    ...(input.mode === "edit"
      ? ([
          { role: "assistant", content: "Here it is. What should I change?" },
          { role: "user", content: input.ask },
        ] satisfies ModelMessage[])
      : []),
  ];
}

export const artifactEditSuite: EvalSuite<
  ArtifactInput,
  { check: string },
  ArtifactOutput
> = {
  id: "artifact-edit",
  name: "Artifact edits",
  kind: "generation",
  stage: "tools/artifacts.ts createArtifact + updateArtifact",
  description:
    "Creates and edits an artifact through the production tool descriptions and file format, with one retry on a save error like the chat. Passes only when the requested change is there and every other block is unchanged.",
  cases: CASES,
  productionModel: CHAT_MODEL_ID,
  /** 2: a summary that follows a changed headline number passes. */
  scoringVersion: 2,
  defaultContenders: ["openai/gpt-5.6-luna", "anthropic/claude-sonnet-5"],
  timeoutMs: 120_000,
  async run(input, ctx) {
    const name = input.mode === "edit" ? "updateArtifact" : "createArtifact";
    const tools = {
      createArtifact: tool({
        description: ARTIFACT_TOOL_GUIDE.create,
        inputSchema: createArtifactInputSchema,
      }),
      updateArtifact: tool({
        description: ARTIFACT_TOOL_GUIDE.update,
        inputSchema: updateArtifactInputSchema,
      }),
      getArtifact: tool({
        description: ARTIFACT_TOOL_GUIDE.get,
        inputSchema: getArtifactInputSchema,
      }),
      getTraffic: tool({
        description: "Reads AI traffic.",
        inputSchema: z.object({}),
      }),
    };
    const messages = history(input);
    let output: ArtifactOutput = { content: null, error: null, attempts: 0 };
    const steps: Awaited<ReturnType<typeof generateText>>["steps"] = [];
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const result = await generateText({
        model: getGateway()(ctx.contender.modelId),
        system:
          "You are Notra's assistant. Build or change artifacts with the artifact tools, using only numbers the tools returned, and change nothing the user didn't ask for.",
        messages,
        tools,
        toolChoice: { type: "tool", toolName: name },
        abortSignal: ctx.abortSignal,
        maxRetries: 0,
        providerOptions: {
          gateway: {
            disallowPromptTraining: true,
            tags: ["eval-artifact-edit"],
          },
        },
      });
      steps.push(...result.steps);
      const call = result.toolCalls[0];
      const file =
        call && typeof call.input === "object" && call.input !== null
          ? (call.input as { content?: unknown }).content
          : undefined;
      const parsed =
        typeof file === "string" ? parseArtifactFile(file) : undefined;
      const error = parsed
        ? parsed.issues
            .map((issue) => `Line ${issue.line}: ${issue.message}`)
            .join(" ")
        : "no file sent";
      output = {
        content: error ? null : (parsed?.content ?? null),
        error: error || null,
        attempts: attempt,
      };
      if (!error || !call) {
        break;
      }
      messages.push(
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: call.toolCallId,
              toolName: name,
              input: call.input,
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: call.toolCallId,
              toolName: name,
              output: {
                type: "error-text",
                value: `Nothing was saved. Fix the file and send it again. ${error}`,
              },
            },
          ],
        }
      );
    }
    const usage = toUsage(
      steps.reduce(
        (sum, step) => ({
          inputTokens: (sum.inputTokens ?? 0) + (step.usage.inputTokens ?? 0),
          outputTokens:
            (sum.outputTokens ?? 0) + (step.usage.outputTokens ?? 0),
        }),
        { inputTokens: 0, outputTokens: 0 }
      )
    );
    return {
      output,
      usage,
      ...(await runCostDetails(
        ctx.contender.modelId,
        usage,
        steps.map((step) => ({
          usage: step.usage,
          providerMetadata: step.providerMetadata,
        }))
      )),
      transcript: output.content
        ? serializeArtifactFile(output.content)
        : (output.error ?? ""),
    };
  },
  score(output, testCase) {
    const check = CHECKS[testCase.expected.check];
    if (!check) {
      throw new Error(`No check named ${testCase.expected.check}`);
    }
    const why = output.content ? check(output.content) : output.error;
    const fields: FieldScore[] = [
      {
        field: "saved",
        score: output.content ? 1 : 0,
        gate: true,
        note: output.error ?? undefined,
      },
      { field: "first-try", score: output.attempts === 1 ? 1 : 0 },
      {
        field: "change",
        score: why ? 0 : 1,
        gate: true,
        note: why ?? undefined,
      },
    ];
    if (why) {
      return { score: 0, pass: false, fields };
    }
    return { score: output.attempts === 1 ? 1 : 0.8, pass: true, fields };
  },
  demoOutput(testCase, demo) {
    return demo.hit()
      ? { content: REPORT, error: null, attempts: 1 }
      : { content: null, error: "Line 1: demo failure", attempts: 2 };
  },
};
