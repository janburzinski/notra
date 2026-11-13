import { MODEL_IDS, MODELS } from "@/constants/models";
import type { ModelId, ModelSpec } from "@/types/game";

export function modelSpec(id: ModelId): ModelSpec {
  const spec = MODELS.find((model) => model.id === id);
  if (!spec) {
    throw new Error(`Unknown model ${id}`);
  }
  return spec;
}

export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && MODEL_IDS.includes(value as ModelId);
}

/** Everyone but the player's own model, in picker order. */
export function rivalsOf(id: ModelId): ModelId[] {
  return MODEL_IDS.filter((model) => model !== id);
}
