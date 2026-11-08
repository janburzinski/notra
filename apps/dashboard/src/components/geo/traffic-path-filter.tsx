"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import {
  ArrowDown01Icon,
  FilterHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@notra/ui/components/ui/combobox";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import {
  TRAFFIC_PATH_ALL,
  TRAFFIC_PATH_FILTER_LIMIT,
} from "@/constants/traffic-path";
import { useTrafficPathQuery } from "@/lib/hooks/use-traffic-path";
import type { TrafficPathFilterProps } from "@/types/geo";

export function TrafficPathFilter({ paths }: TrafficPathFilterProps) {
  const t = useTranslations("geo.trafficPathFilter");
  const [path, setPath] = useTrafficPathQuery();
  // The selected path leads so the row limit never hides it.
  const options = [
    TRAFFIC_PATH_ALL,
    ...(path ? [path] : []),
    ...paths.filter((known) => known !== path),
  ];
  const label = (value: string) =>
    value === TRAFFIC_PATH_ALL ? t("allPages") : value;

  return (
    <Combobox
      itemToStringLabel={label}
      items={options}
      limit={TRAFFIC_PATH_FILTER_LIMIT}
      onValueChange={(next) => {
        void setPath(!next || next === TRAFFIC_PATH_ALL ? "" : next);
      }}
      value={path || TRAFFIC_PATH_ALL}
    >
      <ComboboxPrimitive.Trigger
        aria-label={t("label")}
        render={<Button className="max-w-56" variant="secondary" />}
      >
        <HugeiconsIcon
          className="text-muted-foreground size-3.5 shrink-0"
          icon={FilterHorizontalIcon}
        />
        <span className="truncate">{path || t("label")}</span>
        <HugeiconsIcon
          className="text-muted-foreground pointer-events-none size-4 shrink-0"
          icon={ArrowDown01Icon}
          strokeWidth={2}
        />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent align="end" className="w-72">
        <ComboboxInput placeholder={t("search")} showTrigger={false} />
        <ComboboxEmpty>{t("noMatches")}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="truncate">{label(item)}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
