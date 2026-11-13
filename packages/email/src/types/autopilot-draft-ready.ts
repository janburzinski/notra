export interface AutopilotDraftSource {
  title: string;
  url: string;
  /** GitHub login of who opened it. */
  author?: string | null;
}

/** What the draft is: a new post, a change to an existing page, or a site fix. */
export type AutopilotDraftKind = "post" | "update" | "fix";

export interface AutopilotDraftReadyEmailProps {
  organizationName: string;
  organizationSlug: string;
  draftTitle: string;
  /** Why Autopilot wrote it, in its own words. */
  reason?: string | null;
  draftKind: AutopilotDraftKind;
  repository: string;
  pullRequestNumber: number;
  pullRequestUrl: string;
  /** The changes the draft is based on, usually one merged pull request. */
  sources: AutopilotDraftSource[];
  reviewLink: string;
}
