import type { RefObject } from "react";

export interface McpClient {
  id: "claude-code" | "codex" | "cursor" | "hermes" | "openclaw" | "other";
  label: string;
  iconSrc?: string;
  invertInDark: boolean;
  command: string;
}

export interface McpToolCard {
  name: string;
  description: string;
}

export interface McpTerminalToolCall {
  tool: string;
  arg: string;
  result: string;
}

export interface McpCommandTabsProps {
  className?: string;
}

export interface McpHeroProps {
  subhead: string;
}

export interface McpHeroBattleProps {
  avoidRef: RefObject<HTMLElement | null>;
  areaRef: RefObject<HTMLElement | null>;
}

export interface McpToolCategory {
  id: string;
  label: string;
  match: RegExp;
}

export interface McpToolGroup {
  id: string;
  label: string;
  tools: McpToolCard[];
}

export interface McpTerminalDemoProps {
  toolCount: number;
}

export interface McpToolsGridProps {
  tools: McpToolCard[];
}

export interface McpJsonRpcToolsListResponse {
  result?: {
    tools?: {
      name?: string;
      description?: string;
    }[];
  };
}
