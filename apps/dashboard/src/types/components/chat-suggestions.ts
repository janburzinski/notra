import type { IconSvgElement } from "@hugeicons/react";

type ChatSuggestionId =
  | "blogPost"
  | "releaseNotes"
  | "socialPost"
  | "newsletter"
  | "comparison"
  | "geoStatus"
  | "geoVisibility"
  | "brandVoice"
  | "thread"
  | "faq"
  | "competitorWatch"
  | "visibilityDigest"
  | "comebackPlan"
  | "workflowExplain"
  | "workflowLastRun"
  | "workflowChange"
  | "automationExplain"
  | "automationAlongside";

export interface ChatSuggestion {
  id: ChatSuggestionId;
  icon: IconSvgElement;
}

export interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  hidden?: boolean;
  suggestions?: ChatSuggestion[];
  dismissStorageKey?: string;
  layout?: "grid" | "list";
  rotate?: boolean;
  rotateIntervalMs?: number;
  visibleCount?: number;
}

export interface SuggestionCardProps {
  suggestion: ChatSuggestion;
  disabled?: boolean;
  hidden: boolean;
  onSelect: (prompt: string) => void;
  layout: "grid" | "list";
  slotIndex: number;
  reduceMotion: boolean;
}

type ChatPromptSuggestionSource =
  | "draft"
  | "gap"
  | "shipped"
  | "repo"
  | "brand"
  | "starter";

export interface ChatPromptSuggestion {
  id: string;
  source: ChatPromptSuggestionSource;
  icon: IconSvgElement;
  title: string;
  description: string;
  prompt: string;
}

export interface ChatHomeSuggestionsProps {
  suggestions: ChatPromptSuggestion[];
  heading: string;
  isLoading: boolean;
  disabled?: boolean;
  hidden?: boolean;
  onSelect: (prompt: string) => void;
}
