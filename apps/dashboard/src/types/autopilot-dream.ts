import type { AUTOPILOT_DREAM_LESSON_AREAS } from "@/constants/autopilot-dream";

export type AutopilotLessonArea = (typeof AUTOPILOT_DREAM_LESSON_AREAS)[number];

export interface AutopilotLessonSource {
  pullRequest: string;
  date: string;
}

export interface AutopilotLessonCandidate {
  repository: string;
  key: string;
  area: AutopilotLessonArea;
  lesson: string;
  sources: AutopilotLessonSource[];
  explicit: boolean;
  firstSeenAt: string;
}

export interface AutopilotConvention {
  key: string;
  area: AutopilotLessonArea;
  lesson: string;
  learnedAt: string;
  sources: AutopilotLessonSource[];
}

export interface AutopilotDreamState {
  version: 1;
  lastDreamAt: string | null;
  learnedPullRequests: string[];
  candidates: AutopilotLessonCandidate[];
  checked: Record<string, string>;
  deferredChecks: boolean;
  feedbackHash: string | null;
}

export interface AutopilotDreamEntry {
  key: string;
  changedAt: string;
}

export interface AutopilotPullRequestReview {
  findingId: string;
  repository: string;
  pullRequest: string;
  number: number;
  title: string;
  outcome: "merged" | "closed";
  closedAt: string;
  edited: boolean;
  patch: string;
  comments: string[];
}

export interface AutopilotDreamLesson {
  pullRequest: string;
  key: string;
  area: AutopilotLessonArea;
  lesson: string;
  explicit: boolean;
  reverses: boolean;
}

export interface AutopilotTopicMerge {
  keep: string;
  drop: string[];
}

export interface AutopilotDreamReport {
  reviewed: string[];
  learned: string[];
  tidied: string[];
  verified: string[];
}

export interface AutopilotDreamActivity {
  since: string | null;
  reasons: string[];
}

export interface AutopilotDailyNoteInput {
  date: string;
  since: string | null;
  merged: string[];
  closed: string[];
  opened: string[];
  ideas: string[];
  answers: number;
  report: AutopilotDreamReport;
}

interface AutopilotDreamPullRequest {
  pullRequest: string;
  date: string;
  commented: boolean;
  edited: boolean;
}

export interface AutopilotDreamConsolidation {
  reviewed: AutopilotDreamPullRequest[];
  lessons: AutopilotDreamLesson[];
  merges: AutopilotTopicMerge[];
}

export type AutopilotDreamBlockState = {
  since: string | null;
  consolidation: AutopilotDreamConsolidation;
  learned: string[];
  tidied: string[];
  verified: string[];
};
