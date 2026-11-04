import type { ComponentProps } from "react";

import type { UseCopyToClipboardOptions } from "@notra/ui/types/copy-button";

export interface AgentPromptButtonProps
  extends Omit<ComponentProps<"button">, "children" | "onCopy"> {
  /** The prompt written to the clipboard on click. */
  prompt: string;
  label: string;
  copiedLabel: string;
  /** Runs after the prompt landed on the clipboard. */
  onCopy?: () => void;
  onCopyError?: UseCopyToClipboardOptions["onError"];
  variant?: "default" | "sidebar";
}

export interface AgentPromptSwapLabelProps {
  copied: boolean;
  /** False until the first copy, so the label doesn't animate on mount. */
  animate: boolean;
  label: string;
  copiedLabel: string;
}
