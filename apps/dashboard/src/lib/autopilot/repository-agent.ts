import { AGENT_DEFAULT_MODEL } from "@notra/ai/constants/models";
import { gateway } from "@notra/ai/gateway";
import { withRouterDefaults } from "@notra/ai/provider-options";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";
import {
  isStepCount,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  ToolLoopAgent,
  tool,
} from "ai";
import * as z from "zod";

import {
  AUTOPILOT_CONTEXT_FILE_MAX_CHARS,
  AUTOPILOT_PROTECTED_PATH_PATTERNS,
  AUTOPILOT_READINESS_AGENT_WRAP_UP_SHARE,
  AUTOPILOT_READINESS_AGENT_WRAP_UP_STEPS,
  AUTOPILOT_READINESS_FIND_MAX_PATHS,
  AUTOPILOT_TREE_MAX_PATHS,
} from "@/constants/autopilot";
import {
  getBaseBranchSha,
  getRepositoryOctokit,
  listRepositoryPaths,
  readRepositoryFile,
  repositoryPathExists,
} from "@/lib/autopilot/github";
import type {
  AutopilotRepository,
  AutopilotRunContext,
} from "@/types/autopilot";
import type {
  AutopilotLogger,
  AutopilotStagedFile,
} from "@/types/autopilot-runtime";
import { isSafeRepositoryPath } from "@/utils/autopilot-paths";

function isProtectedPath(path: string) {
  return AUTOPILOT_PROTECTED_PATH_PATTERNS.some((pattern) =>
    pattern.test(path)
  );
}

/**
 * Explore while the budget lasts, then only stage or skip, then answer with no
 * tools left, so the run always ends with an answer instead of a cut-off loop.
 */
function agentPhase(
  steps: readonly { usage: { inputTokens?: number | undefined } }[],
  stepNumber: number,
  limits: { inputTokenBudget: number; maxSteps: number }
) {
  const spent = steps.reduce(
    (sum, step) => sum + (step.usage.inputTokens ?? 0),
    0
  );
  if (spent >= limits.inputTokenBudget || stepNumber >= limits.maxSteps - 1) {
    return { phase: "answer" as const, spent };
  }
  if (
    spent >=
      limits.inputTokenBudget * AUTOPILOT_READINESS_AGENT_WRAP_UP_SHARE ||
    stepNumber >= limits.maxSteps - AUTOPILOT_READINESS_AGENT_WRAP_UP_STEPS
  ) {
    return { phase: "wrap-up" as const, spent };
  }
  return { phase: "explore" as const, spent };
}

/**
 * An agent that explores the website repository with read-only tools and
 * stages complete files for one pull request; every call is logged. Existing
 * files may only be replaced after they were read in full, protected paths
 * never, and `checkFile` can veto a file with a reason the agent sees.
 */
export async function runRepositoryAgent<Schema extends z.ZodType>(params: {
  ctx: AutopilotRunContext;
  repository: AutopilotRepository;
  log: AutopilotLogger;
  onUsage: (usage: AgentTokenUsage) => void;
  /** Gateway tag and telemetry route, e.g. "readiness-agent". */
  tag: string;
  instructions: string;
  wrapUpNote: string;
  finalNote: string;
  /** Ids the agent attaches to staged files and skips. */
  issueIds: string[];
  issueName: (issueId: string) => string;
  /** Called with the repository paths once listed. */
  prompt: (paths: string[]) => string;
  outputSchema: Schema;
  fallbackOutput: (files: AutopilotStagedFile[]) => z.infer<Schema>;
  maxFiles: number;
  maxSteps: number;
  inputTokenBudget: number;
  checkFile?: (file: {
    path: string;
    content: string;
    previous: string | null;
  }) => string | null;
}) {
  const { ctx, repository, log } = params;
  const octokit = await getRepositoryOctokit(ctx.organizationId, repository);
  const baseSha = await getBaseBranchSha(octokit, repository);
  const paths = await listRepositoryPaths(octokit, repository, baseSha);
  const existingPaths = new Set(paths);
  const issueIds = new Set(params.issueIds);
  // Existing files may only be replaced when the agent read them in full.
  const fullyRead = new Map<string, string>();
  const staged = new Map<string, AutopilotStagedFile>();
  const skipped: { issueId: string; reason: string }[] = [];
  const limits = {
    inputTokenBudget: params.inputTokenBudget,
    maxSteps: params.maxSteps,
  };

  const tools = {
    findFiles: tool({
      description:
        "Find repository files whose path contains the query, ignoring case, e.g. robots, sitemap, llms or layout.",
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const needle = query.toLowerCase();
        const matches = paths.filter((path) =>
          path.toLowerCase().includes(needle)
        );
        await log.info(`Searched for "${query}"`, { files: matches.length });
        const shown = matches.slice(0, AUTOPILOT_READINESS_FIND_MAX_PATHS);
        if (shown.length === 0) {
          return "(no files)";
        }
        return matches.length > shown.length
          ? `${shown.join("\n")}\n(${matches.length - shown.length} more, narrow the query)`
          : shown.join("\n");
      },
    }),
    listFiles: tool({
      description:
        "List repository files under a directory. Use an empty string for the whole repository.",
      inputSchema: z.object({ directory: z.string() }),
      execute: async ({ directory }) => {
        const prefix = directory.replace(/^\/+|\/+$/g, "");
        const matches = paths
          .filter((path) => !prefix || path.startsWith(`${prefix}/`))
          .slice(0, AUTOPILOT_TREE_MAX_PATHS);
        await log.info(`Listed ${prefix || "/"}`, { files: matches.length });
        return matches.join("\n") || "(no files)";
      },
    }),
    readFile: tool({
      description: "Read one repository file.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        if (
          !(
            existingPaths.has(path) ||
            (isSafeRepositoryPath(path) &&
              (await repositoryPathExists(octokit, repository, path, baseSha)))
          )
        ) {
          return "File does not exist.";
        }
        const content = await readRepositoryFile(
          octokit,
          repository,
          path,
          baseSha
        );
        if (content === null) {
          return "File could not be read.";
        }
        const truncated = content.length > AUTOPILOT_CONTEXT_FILE_MAX_CHARS;
        if (!truncated) {
          fullyRead.set(path, content);
        }
        await log.info(`Read ${path}`, { chars: content.length, truncated });
        return truncated
          ? `${content.slice(0, AUTOPILOT_CONTEXT_FILE_MAX_CHARS)}\n(truncated: this file is too large to replace)`
          : content;
      },
    }),
    writeFile: tool({
      description:
        "Stage the complete new content of one file for the pull request.",
      inputSchema: z.object({
        path: z.string().describe("Repository-relative path"),
        content: z.string().describe("Complete new file content"),
        issueIds: z.array(z.string()),
        reason: z.string(),
      }),
      execute: async (file) => {
        let rejection: string | null = null;
        if (!isSafeRepositoryPath(file.path) || isProtectedPath(file.path)) {
          rejection = "This path is not allowed.";
        } else if (
          !fullyRead.has(file.path) &&
          (existingPaths.has(file.path) ||
            // The tree listing can be truncated; ask GitHub before calling it new.
            (await repositoryPathExists(
              octokit,
              repository,
              file.path,
              baseSha
            )))
        ) {
          rejection = "Read the whole file before replacing it.";
        } else if (!staged.has(file.path) && staged.size >= params.maxFiles) {
          rejection = `You already staged ${params.maxFiles} files.`;
        } else {
          rejection =
            params.checkFile?.({
              path: file.path,
              content: file.content,
              previous: fullyRead.get(file.path) ?? null,
            }) ?? null;
        }
        if (rejection) {
          await log.skip(`Rejected write to ${file.path}`, {
            reason: rejection,
          });
          return `Rejected: ${rejection}`;
        }
        const fileIssueIds = file.issueIds.filter((id) => issueIds.has(id));
        staged.set(file.path, { ...file, issueIds: fileIssueIds });
        await log.action(
          `${existingPaths.has(file.path) ? "Changed" : "Created"} ${file.path}`,
          { issueIds: fileIssueIds, reason: file.reason }
        );
        return "Staged.";
      },
    }),
    skipIssue: tool({
      description: "Leave an issue alone and say why.",
      inputSchema: z.object({ issueId: z.string(), reason: z.string() }),
      execute: async (skip) => {
        skipped.push(skip);
        await log.decision(`Left "${params.issueName(skip.issueId)}" alone`, {
          reason: skip.reason,
        });
        return "Noted.";
      },
    }),
  };

  let loggedPhase: ReturnType<typeof agentPhase>["phase"] = "explore";
  const agent = new ToolLoopAgent({
    model: gateway(AGENT_DEFAULT_MODEL, {
      organizationId: ctx.organizationId,
    }),
    providerOptions: withRouterDefaults(
      { gateway: { tags: ["autopilot", params.tag] } },
      { modelId: AGENT_DEFAULT_MODEL }
    ),
    instructions: params.instructions,
    tools,
    output: Output.object({ schema: params.outputSchema }),
    stopWhen: isStepCount(params.maxSteps),
    prepareStep: async ({ steps, stepNumber }) => {
      const { phase, spent } = agentPhase(steps, stepNumber, limits);
      if (phase !== loggedPhase) {
        loggedPhase = phase;
        await log.info(
          phase === "answer"
            ? "Writing the pull request description"
            : "Done exploring, staging the fix",
          { inputTokens: spent, step: stepNumber + 1 }
        );
      }
      if (phase === "answer") {
        return {
          activeTools: [],
          instructions: `${params.instructions} ${params.finalNote}`,
        };
      }
      if (phase === "wrap-up") {
        return {
          activeTools: ["writeFile", "skipIssue"],
          instructions: `${params.instructions} ${params.wrapUpNote}`,
        };
      }
      return undefined;
    },
    ...buildTelemetryOptions({
      feature: "autopilot",
      organizationId: ctx.organizationId,
      routeName: `autopilot/${params.tag}`,
    }),
  });

  const startedAt = Date.now();
  let stepNumber = 0;
  const prompt = params.prompt(paths);
  await log.trace(`${params.tag} prompt`, {
    model: AGENT_DEFAULT_MODEL,
    instructions: params.instructions,
    prompt,
  });
  const result = await agent
    .generate({
      prompt,
      onStepEnd: async (step) => {
        stepNumber += 1;
        await log.trace(`Agent step ${stepNumber}`, {
          text: step.text,
          reasoning: step.reasoningText ?? null,
          toolCalls: step.toolCalls.map((call) => ({
            tool: call.toolName,
            input: call.input,
          })),
          toolResults: step.toolResults.map((toolResult) => ({
            tool: toolResult.toolName,
            output: toolResult.output,
          })),
          inputTokens: step.usage.inputTokens ?? null,
          outputTokens: step.usage.outputTokens ?? null,
        });
      },
    })
    .catch((error: unknown) => {
      // Staged files are the work; a broken final answer shouldn't throw them away.
      if (!(NoObjectGeneratedError.isInstance(error) && staged.size > 0)) {
        throw error;
      }
      params.onUsage({
        ...toAgentTokenUsage(error.usage),
        modelId: AGENT_DEFAULT_MODEL,
      });
      return null;
    });
  let output: z.infer<Schema> | null = null;
  if (result) {
    params.onUsage({
      ...toAgentTokenUsage(result.totalUsage),
      modelId: AGENT_DEFAULT_MODEL,
    });
    try {
      output = result.output as z.infer<Schema>;
    } catch (error) {
      if (!(NoOutputGeneratedError.isInstance(error) && staged.size > 0)) {
        throw error;
      }
    }
  }
  const files = [...staged.values()];
  await log.action(
    `Agent finished with ${AGENT_DEFAULT_MODEL}`,
    {
      model: AGENT_DEFAULT_MODEL,
      steps: result?.steps.length ?? stepNumber,
      inputTokens: result?.totalUsage.inputTokens ?? null,
      outputTokens: result?.totalUsage.outputTokens ?? null,
      durationMs: Date.now() - startedAt,
      staged: staged.size,
      answered: output !== null,
    },
    { output, skipped }
  );
  return {
    octokit,
    baseSha,
    paths,
    output: output ?? params.fallbackOutput(files),
    files,
    skipped,
  };
}
