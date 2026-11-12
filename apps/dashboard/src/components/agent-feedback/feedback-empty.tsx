"use client";

import { InboxIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { useTranslations } from "use-intl";

import { AgentFeedbackSetup } from "@/components/agent-feedback/feedback-setup";
import { CopyPromptButton } from "@/components/geo/code-snippet";
import { useAgentFeedbackSetup } from "@/lib/hooks/use-agent-feedback";
import type { AgentFeedbackEmptyProps } from "@/types/agent-feedback";

export function AgentFeedbackEmpty({
  organizationId,
}: AgentFeedbackEmptyProps) {
  const t = useTranslations("feedback");
  const { data: setup } = useAgentFeedbackSetup(organizationId);

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={InboxIcon} />
        </EmptyMedia>
        <EmptyTitle>{t("empty.title")}</EmptyTitle>
        <EmptyDescription>{t("empty.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl items-stretch text-left">
        <div>
          <div className="border-shell-border bg-shell flex h-[4.25rem] w-full items-center justify-between gap-3 rounded-t-2xl border border-b-0 px-4 pb-5 sm:px-5">
            <h4 className="text-sm font-semibold text-balance">
              {t("setup.title")}
            </h4>
            <CopyPromptButton
              className="shrink-0"
              disabled={!setup}
              prompt={setup?.prompt ?? ""}
            />
          </div>
          <AgentFeedbackSetup
            className="border-table-card-border bg-table-card shadow-table-card relative -mt-5 w-full rounded-2xl border p-4 sm:p-5"
            setup={setup}
          />
        </div>
      </EmptyContent>
    </Empty>
  );
}
