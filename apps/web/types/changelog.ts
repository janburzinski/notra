import type { ReactNode } from "react";

export interface ChangelogPageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description: ReactNode;
  meta?: ReactNode;
}

interface ChangelogTimelineItem {
  id: string;
  title: string;
  description: string;
  href: string;
  date: string;
}

export interface ChangelogTimelineProps {
  items: ChangelogTimelineItem[];
  featuredLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export interface ChangelogFeaturedEntryProps {
  item: ChangelogTimelineItem;
  label?: string;
}

export interface ChangelogRowProps {
  item: ChangelogTimelineItem;
}
