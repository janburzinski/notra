import { GitBranchIcon, Package01Icon } from "@hugeicons/core-free-icons";
import type { WebhookEventType } from "@notra/schemas/dashboard/integrations";
import type { DataTableSkeletonColumn } from "@notra/ui/types/data-table";

interface EventTypeMeta {
  icon: typeof GitBranchIcon;
  iconClass: string;
}

export const EVENT_TYPE_META: Record<WebhookEventType, EventTypeMeta> = {
  release: {
    icon: Package01Icon,
    iconClass: "text-violet-500 dark:text-violet-300",
  },
  push: {
    icon: GitBranchIcon,
    iconClass: "text-emerald-500 dark:text-emerald-300",
  },
};

export const EVENT_TYPE_ORDER: WebhookEventType[] = ["release", "push"];

/** Source, events, identity, output, sources, enabled, created, actions. */
export const EVENT_TABLE_SKELETON_COLUMNS: readonly DataTableSkeletonColumn[] =
  [
    { width: "1fr", minWidth: "13rem" },
    "8rem",
    "12rem",
    "10rem",
    "8rem",
    "7rem",
    "10rem",
    "5rem",
  ];
