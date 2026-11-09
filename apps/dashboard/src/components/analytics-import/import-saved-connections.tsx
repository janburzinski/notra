"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import type { ImportSavedConnectionsProps } from "@/types/components/analytics-import";

import { ImportFrame } from "./import-frame";
import { ImportProviderMark } from "./import-provider-mark";

export function ImportSavedConnections({
  connections,
  canManage,
  onSelect,
}: ImportSavedConnectionsProps) {
  const t = useTranslations("geo.analyticsImport");

  return (
    <div className="flex flex-col gap-3">
      <ImportFrame title={t("connect.existing")}>
        <ul className="divide-table-row-border divide-y">
          {connections.map((connection) => (
            <li className="group/row" key={connection.id}>
              <button
                className="hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-ring/50 flex w-full items-center gap-3 px-3 py-2 text-start text-sm font-medium transition-colors duration-150 outline-none group-first/row:rounded-t-xl group-last/row:rounded-b-xl focus-visible:ring-3 focus-visible:ring-inset"
                onClick={() => onSelect(connection.id)}
                type="button"
              >
                <ImportProviderMark provider={connection.provider} />
                <span className="min-w-0 flex-1 truncate">
                  {connection.label}
                </span>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0"
                  icon={ArrowRight01Icon}
                />
              </button>
            </li>
          ))}
        </ul>
      </ImportFrame>
      {canManage ? (
        <p className="text-muted-foreground mt-2 text-xs font-medium">
          {t("connect.newConnection")}
        </p>
      ) : null}
    </div>
  );
}
