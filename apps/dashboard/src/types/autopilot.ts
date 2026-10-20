import type { IconSvgElement } from "@hugeicons/react";
import type {
  AutopilotFindingEvidence,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";
import type { InferRouterOutputs } from "@orpc/server";
import type { ReactNode } from "react";
import type * as z from "zod";

import type { AUTOPILOT_PAGE_TABS } from "@/constants/autopilot-ui";
import type { DashboardRouter } from "@/lib/orpc/router";
import type { autopilotPullRequestEventSchema } from "@/schemas/autopilot-github";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type { GitHubMergeMethod } from "@/types/integrations/github";
import type { OnboardingProgressHrefs } from "@/types/onboarding";

export interface AutopilotRepository {
  owner: string;
  name: string;
  branch: string;
}

export interface AutopilotRunContext {
  organizationId: string;
  organizationSlug: string;
  runId: string;
  projectId: string | null;
  repository: AutopilotRepository | null;
  contentPath: string | null;
  jobs: Record<AutopilotJobKind, boolean>;
  maxOpenPullRequests: number;
  /** Untouched drafts are closed after this many days; null keeps them. */
  stalePullRequestDays: number | null;
  brand: {
    name: string;
    websiteUrl: string;
    description: string;
    audience: string | null;
    language: string;
    /** Brand house rules from the identity settings; the writer follows them. */
    customInstructions: string | null;
    /** brand_settings id, for the brand's colors and logo. */
    settingsId: string;
  } | null;
}

export interface AutopilotProposal {
  kind: AutopilotJobKind;
  fingerprint: string;
  title: string;
  summary: string;
  evidence: AutopilotFindingEvidence;
}

export type AutopilotPullRequestEvent = z.infer<
  typeof autopilotPullRequestEventSchema
>;

export interface MergedPullRequest {
  /** owner/name */
  repository: string;
  number: number;
  title: string;
  url: string;
  /** Whitespace-collapsed and clipped for prompts. */
  body: string;
}

export interface AutopilotJobResult {
  findingIds: string[];
  /** Lines worth showing in the brief. */
  insights: string[];
}

export interface AutopilotWorkflowPayload {
  organizationId: string;
  runId: string;
}

export interface AutopilotSuggestionWorkflowPayload {
  organizationId: string;
  findingId: string;
  /** Run created at enqueue time; internal callers may omit it. */
  runId?: string;
}

export interface AutopilotPullRequestWorkflowPayload {
  deliveryId: string;
  rawBody: string;
}

export type AutopilotWorkflowResult =
  | { status: "completed"; runId: string; findings: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; runId: string; error: string };

type AutopilotOverview =
  InferRouterOutputs<DashboardRouter>["autopilot"]["get"];

export type AutopilotSettingsView = AutopilotOverview["settings"];

export type AutopilotFindingView = AutopilotOverview["findings"][number];

export type AutopilotRunView = AutopilotOverview["runs"][number];

export interface AutopilotSetupFormProps {
  organizationId: string;
  callbackPath: string;
  overview: AutopilotOverview;
  /** Project in scope; used only until Autopilot has a saved project. */
  projectId?: string | null;
  submitLabel: string;
  onSaved?: () => void;
}

export interface AutopilotPageClientProps {
  organizationSlug: string;
}

export interface AutopilotOnboardingStepProps {
  organizationId: string;
  callbackPath: string;
  nextHref: string;
  inOnboardingFlow: boolean;
  progressHrefs: OnboardingProgressHrefs;
  projectId?: string;
}

type AutopilotRunEventView =
  InferRouterOutputs<DashboardRouter>["autopilot"]["runEvents"][number];

export interface AutopilotRunsTableProps {
  runs: AutopilotRunView[];
  onSelect: (run: AutopilotRunView) => void;
}

export interface AutopilotPendingFindingAction {
  kind: "merge" | "dismiss";
  finding: AutopilotFindingView;
}

export interface AutopilotFindingConfirmDialogProps {
  organizationId: string;
  pending: AutopilotPendingFindingAction | null;
  branch: string | null;
  onClose: () => void;
}

export interface AutopilotAutomationPageClientProps {
  organizationSlug: string;
  automation: string;
}

export interface AutopilotOverviewPageProps {
  organizationId: string;
  organizationSlug: string;
  overview: AutopilotOverview;
}

export interface AutopilotAutomationPageProps {
  kind: AutopilotAutomationKind;
  organizationId: string;
  organizationSlug: string;
  overview: AutopilotOverview;
}

export interface AutopilotAutomationStatusProps {
  kind: AutopilotAutomationKind;
  overview: AutopilotOverview;
  merging: boolean;
  onMerge: (finding: AutopilotFindingView, method: GitHubMergeMethod) => void;
}

export interface AutopilotTrendProps {
  current: number;
  previous: number | undefined;
  /** Credits cost more when they rise, so a rise reads as worse. */
  higherIsBetter?: boolean;
}

export interface AutopilotAutomationFactsProps {
  kind: AutopilotAutomationKind;
  settings: AutopilotSettingsView;
}

export type AutopilotJobDecisionView =
  InferRouterOutputs<DashboardRouter>["autopilot"]["jobDecisions"][number];

export interface AutopilotJobDecisionsProps {
  kind: AutopilotAutomationKind;
  organizationId: string;
  organizationSlug: string;
}

export interface AutopilotFindingPageClientProps {
  organizationSlug: string;
  findingId: string;
}

export interface AutopilotFindingPageProps {
  organizationId: string;
  organizationSlug: string;
  overview: AutopilotOverview;
  finding: AutopilotFindingView;
}

export interface AutopilotFindingCandidate {
  title: string;
  share: number;
  picked: boolean;
}

export interface AutopilotSetupRowProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

export interface AutopilotRunPageClientProps {
  organizationSlug: string;
  runId: string;
}

export interface AutopilotRunPageProps {
  organizationId: string;
  organizationSlug: string;
  run: AutopilotRunView;
}

export interface AutopilotFactProps {
  label: string;
  children: ReactNode;
}

export interface AutopilotRunTimelineProps {
  run: AutopilotRunView;
  events: AutopilotRunEventView[];
}

export interface AutopilotFindingTranscriptProps {
  finding: AutopilotFindingView;
  events: AutopilotRunEventView[];
  /** Why Autopilot made it, as the agent's answer below its steps. */
  children: ReactNode;
}

export type AutopilotRunSectionState =
  | "running"
  | "done"
  | "skipped"
  | "failed";

export interface AutopilotRunSectionProps {
  id: string;
  /** The automation's name, e.g. "Write about releases". */
  label: string;
  events: AutopilotRunEventView[];
  /** Still running: new steps slide in and the duration counts up. */
  live: boolean;
  /** More of what the agent concluded, after what it decided. */
  children?: ReactNode;
  /** What it made, e.g. the pull request. */
  result?: ReactNode;
}

export interface AutopilotRunSectionHeaderProps {
  id: string;
  label: string;
  state: AutopilotRunSectionState;
  /** Null hides the duration: skipped, or live before the clock is known. */
  seconds: number | null;
}

export interface AutopilotRunStepProps {
  step: AutopilotTranscriptStep;
  active: boolean;
}

export interface AutopilotRunPanelProps {
  children: ReactNode;
}

export interface AutopilotLookupsStackProps {
  queries: string[];
  active: boolean;
}

export interface AutopilotReadsStackProps {
  targets: string[];
  active: boolean;
}

/** What a step did, for its icon. */
export type AutopilotTranscriptStepKind =
  | "gather"
  | "lookup"
  | "draft"
  | "image"
  | "skip"
  | "error"
  | "other";

/** One line of a run read as an agent turn; consecutive reads fold into one. */
export type AutopilotTranscriptStep =
  | { type: "reads"; id: string; targets: string[] }
  | { type: "lookups"; id: string; queries: string[] }
  | {
      type: "step";
      id: string;
      kind: AutopilotTranscriptStepKind;
      label: string;
      createdAt: Date;
    };

export interface AutopilotTranscript {
  steps: AutopilotTranscriptStep[];
  /** The pick and how sure Jev was, said by the agent rather than listed. */
  verdict: string | null;
  credits: number | null;
  startedAt: Date | null;
  durationMs: number;
}

export interface AutopilotTableEmptyProps {
  icon: IconSvgElement;
  title: string;
  description: string;
  action?: ReactNode;
}

export interface AutopilotMergeMenuProps {
  size?: "xs" | "sm";
  loading?: boolean;
  onMerge: (method: GitHubMergeMethod) => void;
}

export interface AutopilotFindingStatusProps {
  finding: AutopilotFindingView;
}

export interface AutopilotStatStripProps {
  stats: {
    label: string;
    value: number | string | null | undefined;
    trend?: ReactNode;
  }[];
  busy?: boolean;
}

export interface AutopilotBackLinkProps {
  slug: string;
  tab?: (typeof AUTOPILOT_PAGE_TABS)[number];
}

export interface AutopilotPageShellProps {
  organizationSlug: string;
  children: (context: {
    organizationId: string;
    overview: AutopilotOverview;
  }) => ReactNode;
}

export interface AutopilotPullRequestsTableProps {
  findings: AutopilotFindingView[];
  readOnly: boolean;
  /** Off on an automation's own page, where every row has the same one. */
  showAutomation?: boolean;
  /** The idea a Write click is starting, shown without its buttons. */
  writingId: string | null;
  onOpen: (finding: AutopilotFindingView) => void;
  /** The pull request a merge is running for, shown loading. */
  mergingId: string | null;
  onMerge: (finding: AutopilotFindingView, method: GitHubMergeMethod) => void;
  onWrite?: (finding: AutopilotFindingView) => void;
}

export interface AutopilotSettingsRowProps {
  icon: IconSvgElement;
  label: string;
  htmlFor: string;
  children: ReactNode;
}

export interface AutopilotSettingsPanelProps {
  organizationId: string;
  callbackPath: string;
  overview: AutopilotOverview;
}

export interface AutopilotRulesSectionProps {
  organizationId: string;
  rules: AutopilotOverview["rules"];
}
