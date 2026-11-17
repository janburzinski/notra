import type { ChatHistorySource, ChatHistorySourceFilter } from "@/types/chat";

export interface ChatHistoryHeaderProps {
  source: ChatHistorySourceFilter;
  sources: ChatHistorySource[];
  onSourceChange: (source: ChatHistorySourceFilter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
}

export interface ChatSourceIconProps {
  source: ChatHistorySource;
  className?: string;
}
