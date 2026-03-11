import { withSupermemory } from "@supermemory/tools/ai-sdk";
import { gateway } from "@/lib/ai/gateway";
import type { GatewayArgs } from "@/types/ai/gateway";
import type { SupermemoryOptions } from "@/types/ai/model";

export function createModel(
  organizationId: string | undefined,
  modelId: GatewayArgs[0],
  options?: Omit<SupermemoryOptions, "mode" | "addMemory">
) {
  const base = gateway(modelId);

  if (!organizationId) {
    return base;
  }

  return withSupermemory(base, organizationId, {
    mode: "full",
    addMemory: "always",
    ...options,
  });
}
