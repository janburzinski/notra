import type { WebhookEventType } from "@notra/schemas/dashboard/integrations";

import type { useEventTriggerForm } from "@/lib/hooks/use-event-trigger-form";
import type { EventTriggerPreset } from "@/types/automation/automations";
import type { BrandSettings } from "@/types/hooks/brand-analysis";
import type { Trigger } from "@/types/triggers/triggers";

export type { EventTriggerFormValues } from "@notra/schemas/dashboard/automation/event-trigger-form";

export interface EventTriggerFormProps {
  organizationId: string;
  onSuccess?: (trigger: Trigger) => void;
  editTrigger?: Trigger;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Starting values for a new trigger, e.g. from a template. */
  preset?: EventTriggerPreset | null;
  /** Lets a new automation switch to another trigger kind. */
  kindPicker?: React.ReactNode;
}

export interface EventTypeCardProps {
  eventType: WebhookEventType;
  selected: boolean;
  onSelect: () => void;
}

export interface TriggerSwitchRowProps {
  id: string;
  label: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export interface IgnoreCommitPatternsFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  errors: Array<{ message?: string } | undefined>;
  fieldName: string;
}

export interface UseEventTriggerFormProps {
  organizationId: string;
  editTrigger?: Trigger;
  enabled: boolean;
  open: boolean;
  preset?: EventTriggerPreset | null;
  onSuccess?: (trigger: Trigger) => void;
  onClose: () => void;
}

export type EventTriggerFormApi = ReturnType<
  typeof useEventTriggerForm
>["form"];

export interface EventTriggerFormSectionProps {
  form: EventTriggerFormApi;
}

export interface RepositoryOption {
  value: string;
  label: string;
}

export interface EventTriggerRepositoriesSectionProps {
  form: EventTriggerFormApi;
  isLoading: boolean;
  options: RepositoryOption[];
  onAddRepository: () => void;
}

export interface EventTriggerRulesSectionProps {
  form: EventTriggerFormApi;
  brandVoices: BrandSettings[];
}

export interface EventTriggerDialogFooterProps {
  errorMessage: string | null;
  isEditMode: boolean;
  isPending: boolean;
  onCancel: () => void;
}

export interface RepositoryConnectionDialogsProps {
  githubIntegrationId?: string;
  isEditMode: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  organizationId: string;
}
