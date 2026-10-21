import { FileEditIcon } from "@hugeicons/core-free-icons";

import type {
  VariantOutput,
  VariantTemplate,
  VariantTrigger,
} from "./fixtures";

export interface TemplateDraft {
  name: string;
  instructions: string;
  trigger: VariantTrigger;
  output: VariantOutput;
  paths: string;
  enabled: boolean;
}

export const EMPTY_DRAFT: TemplateDraft = {
  name: "",
  instructions: "",
  trigger: "run",
  output: "pull_request",
  paths: "",
  enabled: true,
};

export function draftFrom(
  template: VariantTemplate,
  enabled: boolean
): TemplateDraft {
  return {
    name: template.custom ? template.name : `${template.name} (copy)`,
    instructions: template.instructions,
    trigger: template.trigger,
    output: template.output,
    paths: template.paths ?? "",
    enabled,
  };
}

export function templateFromDraft(draft: TemplateDraft): VariantTemplate {
  return {
    id: `custom-${Date.now()}`,
    custom: true,
    author: "You",
    name: draft.name.trim() || "Untitled automation",
    description: draft.instructions.trim().split("\n")[0] ?? "",
    instructions: draft.instructions,
    category: draft.output === "post" ? "content" : "site",
    icon: FileEditIcon,
    source: draft.paths.trim() || "Your repository",
    output: draft.output,
    trigger: draft.trigger,
    paths: draft.paths.trim() || undefined,
  };
}
