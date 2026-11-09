import type {
  AnalyticsImportConnectionProvider,
  AnalyticsImportProvider,
} from "@notra/db/types/analytics-imports";
import type { ComponentProps, ReactNode } from "react";

import type { PIXEL_OCTOPUS_FRAMES } from "@/constants/pixel-octopus";
import type {
  AnalyticsImportConnectionSummary,
  AnalyticsImportOverlapMode,
  AnalyticsImportPreview,
  AnalyticsImportProgressModel,
  AnalyticsImportProgressPhase,
  AnalyticsImportSummary,
} from "@/types/analytics-imports";

export type AnalyticsImportProviderChoice =
  | "plausible_csv"
  | AnalyticsImportConnectionProvider;

export type AnalyticsImportView =
  | { step: "home" }
  | { step: "csv" }
  | {
      step: "connect";
      provider: AnalyticsImportConnectionProvider;
      /** Set when reconnecting: the new key replaces this connection's. */
      connectionId?: string;
    }
  | {
      step: "source";
      provider: AnalyticsImportConnectionProvider;
      connectionId: string;
    }
  | {
      step: "progress";
      /** As the start call returned it; the polled list takes over once it has it. */
      item: AnalyticsImportSummary;
    };

export interface AnalyticsImportDialogProps {
  organizationId: string;
  projectId: string | null;
  defaultHost: string;
  /** Rendered as the dialog trigger; omit to control `open` from outside. */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Without web analytics: list, delete and disconnect, but no new import. */
  manageOnly?: boolean;
}

export interface ImportDialogHeaderProps {
  view: AnalyticsImportView;
  manageOnly: boolean;
  onBack: () => void;
  /** Focused when a step opens, so keyboard users land on "Back". */
  backRef: React.Ref<HTMLButtonElement>;
}

export interface ImportHomeStepProps extends ImportListProps {
  isPending: boolean;
  manageOnly: boolean;
  onPick: (provider: AnalyticsImportProviderChoice) => void;
}

export interface ImportHistoryCardProps {
  variant?: "cta" | "settings";
  /** Without web analytics: shown only to remove what was imported. */
  manageOnly?: boolean;
}

export interface ImportProviderMarkProps {
  provider: AnalyticsImportProvider;
  className?: string;
}

export interface ImportProviderPickerProps {
  onPick: (provider: AnalyticsImportProviderChoice) => void;
}

export interface ImportListProps {
  organizationId: string;
  /** Owners and admins may delete imports and disconnect accounts. */
  canManage: boolean;
  imports: AnalyticsImportSummary[];
  connections: AnalyticsImportConnectionSummary[];
  /** Omitted when reconnecting is not allowed. */
  onReconnect?: (connection: AnalyticsImportConnectionSummary) => void;
  /** Opens a running import's progress. */
  onOpen?: (item: AnalyticsImportSummary) => void;
}

export interface ImportRowPartProps {
  item: AnalyticsImportSummary;
}

export interface ImportRowProps {
  item: AnalyticsImportSummary;
  organizationId: string;
  canManage: boolean;
  onOpen?: (item: AnalyticsImportSummary) => void;
}

export interface ImportConnectionRowProps {
  connection: AnalyticsImportConnectionSummary;
  organizationId: string;
  canManage: boolean;
  onReconnect?: (connection: AnalyticsImportConnectionSummary) => void;
}

export interface ImportRowMenuProps {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}

export interface ImportCsvStepProps {
  organizationId: string;
  projectId: string;
  defaultHost: string;
  /** Receives the import that just started. */
  onStarted: (item: AnalyticsImportSummary) => void;
}

/** The drop zone root's role, name and description. */
export interface ImportZipRootA11yProps {
  role: "button" | "group";
  "aria-labelledby": string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface ImportZipChosenFileProps {
  file: File;
  disabled: boolean;
  dragging: boolean;
  onRemove: () => void;
}

export interface ImportZipPromptProps {
  dragging: boolean;
  titleId: string;
  hintId: string;
  maxSize: string;
}

export interface ImportZipFieldError {
  text: string;
  /** Changes with each attempt, so a repeated error is announced again. */
  count: number;
}

export interface ImportZipFieldProps {
  file: File | null;
  disabled: boolean;
  /** What the server found wrong with the chosen export. */
  serverError?: ImportZipFieldError | null;
  /** `null` when the file is removed. */
  onChange: (file: File | null) => void;
  /** Inside a numbered step whose title already names the file. */
  hideLabel?: boolean;
}

export interface ImportSavedConnectionsProps {
  connections: AnalyticsImportConnectionSummary[];
  /** Shows the "or add a new one" hint below the list. */
  canManage: boolean;
  onSelect: (connectionId: string) => void;
}

export interface ImportConnectStepProps {
  organizationId: string;
  /** Members may use saved connections but not add new ones. */
  canManage: boolean;
  provider: AnalyticsImportConnectionProvider;
  connections: AnalyticsImportConnectionSummary[];
  /** The connection whose key is being replaced, if reconnecting. */
  reconnectId?: string;
  onConnected: (connectionId: string) => void;
}

export interface ImportSourceStepProps {
  organizationId: string;
  projectId: string;
  connectionId: string;
  defaultHost: string;
  /** Receives the import that just started. */
  onStarted: (item: AnalyticsImportSummary) => void;
  onReconnect: () => void;
}

export interface ImportHostFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Inside a numbered step: its title and description stand in for the label and hint. */
  bare?: boolean;
}

export interface ImportPreviewProps {
  preview: AnalyticsImportPreview;
  overlap: AnalyticsImportOverlapMode;
  onOverlapChange: (overlap: AnalyticsImportOverlapMode) => void;
}

export interface ImportPreviewEmptyProps {
  alreadyImported: boolean;
}

export interface ImportPreviewPageviewsProps {
  kind: AnalyticsImportPreview["kind"];
  pageviews: number | null;
}

export interface ImportOverlapChoiceProps {
  preview: AnalyticsImportPreview;
  overlap: AnalyticsImportOverlapMode;
  onOverlapChange: (overlap: AnalyticsImportOverlapMode) => void;
}

export interface ImportPreviewFooterProps {
  preview: AnalyticsImportPreview | null;
  overlap: AnalyticsImportOverlapMode;
  checkLabel: string;
  canCheck: boolean;
  checking: boolean;
  starting: boolean;
  onCheck: () => void;
  onStart: () => void;
}

export interface ImportFrameProps extends Omit<
  ComponentProps<"section">,
  "title" | "className"
> {
  title: ReactNode;
  icon?: ReactNode;
  /** Sits at the end of the title row, e.g. a status badge. */
  action?: ReactNode;
  /** A short note under the box. */
  footer?: ReactNode;
}

export interface ImportNoticeProps {
  title: string;
  description: string;
  tone?: "default" | "destructive";
  action?: ReactNode;
}

/** Everything the progress view shows comes from the import's summary. */
export interface ImportProgressViewProps {
  item: AnalyticsImportSummary;
}

export interface ImportProgressStepProps {
  item: AnalyticsImportSummary;
  onClose: () => void;
  onBack: () => void;
  /** Back to the source picker, to start an import of another site. */
  onImportAnother?: () => void;
}

export interface ImportProgressFooterProps {
  phase: AnalyticsImportProgressPhase;
  onClose: () => void;
  onViewAnalytics: () => void;
  onBack: () => void;
  onImportAnother?: () => void;
}

export interface ImportActivityPillProps {
  imports: readonly AnalyticsImportSummary[];
  onOpen: () => void;
  className?: string;
}

export type PixelOctopusDance = keyof typeof PIXEL_OCTOPUS_FRAMES;

export interface PixelOctopusProps {
  dance: PixelOctopusDance;
  /** Screen pixels per sprite pixel. */
  scale?: number;
  className?: string;
}
