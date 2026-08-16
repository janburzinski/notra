import type { ReactNode } from "react";

export interface StandaloneChatPageClientProps {
  organizationSlug: string;
  chatId?: string;
}

export interface UserImageGridProps {
  children: ReactNode;
}

export type CreateToolContentType =
  | "blog_post"
  | "changelog"
  | "investor_update"
  | "linkedin_post"
  | "twitter_post";
