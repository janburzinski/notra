import { gateway } from "@notra/ai/gateway";
import { withRouterDefaults } from "@notra/ai/provider-options";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import { buildTelemetryOptions } from "@notra/ai/utils/tcc";
import { toAgentTokenUsage } from "@notra/ai/utils/token-usage";
import { generateText, Output } from "ai";
import type * as z from "zod";

import type { AutopilotLogger } from "@/types/autopilot-runtime";

export async function generateAutopilotObject<T extends z.ZodType>(params: {
  organizationId: string;
  modelId: string;
  tag: string;
  schema: T;
  instructions: string;
  prompt: string;
  maxOutputTokens?: number;
  log: AutopilotLogger;
  /** Reports what the call cost, e.g. to bill an @notra request. */
  onUsage?: (usage: AgentTokenUsage) => void;
}): Promise<z.infer<T>> {
  const startedAt = Date.now();
  const { output, usage } = await generateText({
    model: gateway(params.modelId, { organizationId: params.organizationId }),
    output: Output.object({ schema: params.schema }),
    instructions: params.instructions,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens,
    providerOptions: withRouterDefaults(
      { gateway: { tags: ["autopilot", params.tag] } },
      { modelId: params.modelId }
    ),
    ...buildTelemetryOptions({
      feature: "autopilot",
      organizationId: params.organizationId,
      routeName: `autopilot/${params.tag}`,
    }),
  });
  params.onUsage?.({ ...toAgentTokenUsage(usage), modelId: params.modelId });
  await params.log.action(
    `Called ${params.modelId} (${params.tag})`,
    {
      model: params.modelId,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      durationMs: Date.now() - startedAt,
    },
    {
      instructions: params.instructions,
      prompt: params.prompt,
      output: JSON.stringify(output),
    }
  );
  return output as z.infer<T>;
}
