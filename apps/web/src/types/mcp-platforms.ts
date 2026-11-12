import type { McpClient } from "@/types/mcp";

export type McpPlatformId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "grok"
  | "lovable"
  | "v0"
  | "bolt"
  | "claude-code"
  | "codex"
  | "cursor"
  | "windsurf"
  | "vscode"
  | "openclaw"
  | "hermes"
  | "perplexity"
  | "le-chat"
  | "raycast";

type McpPlatformKind = "chat" | "builder";

export type McpPlatformVariantId = "geo" | "growth" | "aeo" | "seo";

interface McpPlatformScreenshot {
  light: string;
  dark: string;
  alt: string;
}

export interface McpPlatformStep {
  title: string;
  body: string;
  code?: string;
  screenshot?: McpPlatformScreenshot;
}

interface McpPlatformListing {
  label: string;
  href: string;
}

export interface McpPlatform {
  id: McpPlatformId;
  name: string;
  kind: McpPlatformKind;
  iconSrc: string;
  invertInDark: boolean;
  wideIcon?: boolean;
  description: string;
  requirements: string;
  listing?: McpPlatformListing;
  commands?: McpClient[];
  steps: McpPlatformStep[];
}

export interface McpPlatformVariant {
  role: string;
  subhead: string;
  prompts: Record<McpPlatformKind, string>;
}

export interface McpPlatformPageProps {
  platform: McpPlatform;
  variant: McpPlatformVariantId;
}

export interface McpPlatformIconProps {
  platform: McpPlatform;
  className?: string;
}

export interface McpPlatformPromptProps {
  prompt: string;
  platform: McpPlatform;
  variant: McpPlatformVariantId;
}

export interface McpPlatformStepsProps {
  platform: McpPlatform;
}
