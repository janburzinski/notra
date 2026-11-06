import {
  Globe02Icon,
  QuotesIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { GeoBar } from "@notra/ui/components/geo/geo-bar";
import { Badge } from "@notra/ui/components/ui/badge";

import { Brand } from "@/components/state-of-ai-search/report-ui";
import { DATA_PURPOSE_LABELS } from "@/constants/data";
import { vendorDomain } from "@/utils/data";

/** A bot, assistant or company with its company's logo. */
export function DataSource({
  label,
  vendor,
}: {
  label: string;
  vendor: string | null;
}) {
  return (
    <Brand
      className="text-foreground"
      domain={vendorDomain(vendor ?? label) ?? ""}
      name={label}
    />
  );
}

/** The report's small bar and figure; the bar hides on phones. */
export function DataShareBar({
  value,
  max = 1,
  text,
  barClassName,
}: {
  value: number;
  max?: number;
  text: string;
  barClassName: string;
}) {
  return (
    <span className="flex items-center justify-end gap-2.5">
      <GeoBar
        className="hidden w-16 sm:block"
        fillClassName={barClassName}
        max={max}
        value={value}
      />
      <span className="w-14 text-right font-medium tabular-nums">{text}</span>
    </span>
  );
}

const PURPOSE_STYLE: Record<
  string,
  { variant: "secondary" | "info" | "success"; icon: typeof Globe02Icon }
> = {
  "training-crawler": { variant: "secondary", icon: Globe02Icon },
  "search-index": { variant: "info", icon: Search01Icon },
  "assistant-browse": { variant: "success", icon: QuotesIcon },
};

/** Why a bot crawls, as the app's rounded status badge with its icon. */
export function DataPurpose({ purpose }: { purpose: string }) {
  if (!purpose) {
    return null;
  }
  const style = PURPOSE_STYLE[purpose];
  return (
    <Badge
      className="px-2.5 text-xs"
      shape="rounded"
      size="md"
      variant={style?.variant ?? "secondary"}
    >
      {style ? (
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5 shrink-0"
          icon={style.icon}
          strokeWidth={2}
        />
      ) : null}
      {DATA_PURPOSE_LABELS[purpose] ?? purpose}
    </Badge>
  );
}
