import type { GeoTrackedPrompt } from "@notra/geo-core/types/geo";

export type GeoPromptScanMatch =
  | { status: "match"; prompt: GeoTrackedPrompt }
  | {
      status: "choose" | "not_found";
      prompts: { id: string; prompt: string }[];
    };
