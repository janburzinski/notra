"use client";

import { Robot01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useTranslations } from "use-intl";

export function AgentReachEmpty() {
  const t = useTranslations("content.overview.agentReach");

  return (
    <div className={TABLE_FRAME_CLASS}>
      <div className={TABLE_BODY_CLASS}>
        <Empty className="gap-0 px-5 py-6 md:py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Robot01Icon}
                strokeWidth={1.5}
              />
            </EmptyMedia>
            <EmptyTitle className="text-sm">{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription className="text-xs">
              {t("emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
