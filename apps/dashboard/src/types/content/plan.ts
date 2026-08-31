import type {
  GeoBriefInternalLink,
  GeoContentBrief,
  GeoContentSubtype,
} from "@notra/ai/types/geo-writer";

export interface ContentPlanViewProps {
  brief: GeoContentBrief;
  isWriting?: boolean;
  onChange?: (brief: GeoContentBrief) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface PlanTextProps {
  "aria-label": string;
  className?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  onCommit?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  value: string;
}

export interface KeyedPlanLine {
  id: string;
  text: string;
}

export interface KeyedPlanSection {
  id: string;
  heading: string;
  goal: string;
  claims: KeyedPlanLine[];
}

export interface KeyedPlanLink extends GeoBriefInternalLink {
  id: string;
}

export interface KeyedContentPlan {
  targetPrompt: string;
  intent: string;
  contentSubtype: GeoContentSubtype;
  workingTitle: string;
  audience: string;
  jobToBeDone: string;
  sections: KeyedPlanSection[];
  questionsToAnswer: KeyedPlanLine[];
  internalLinks: KeyedPlanLink[];
  acceptanceChecklist: KeyedPlanLine[];
}
