import type { ReactNode } from "react";

export interface CodeBlockProps {
  code: string;
  className?: string;
  filename?: string;
  headerEnd?: ReactNode;
  tabs?: ReactNode;
  variant?: "command" | "panel";
  label?: string;
  wrap?: boolean;
  onCopy?: () => void;
}

export interface CodeBlockTabOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface CodeBlockTabsProps {
  label: string;
  value: string;
  options: readonly CodeBlockTabOption[];
  onValueChange: (value: string) => void;
}

export interface CodeBlockCopyButtonProps {
  code: string;
  label: string;
  onCopy?: () => void;
}

export type CopyStatus = "idle" | "copied" | "failed";
