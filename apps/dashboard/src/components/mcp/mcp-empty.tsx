"use client";

import { McpServerIcon } from "@hugeicons/core-free-icons";
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

import { McpSetup } from "@/components/mcp/mcp-setup";
import type { McpSetupProps } from "@/types/mcp-analytics";

/** Same layout as the website empty state: title, then the install card. */
export function McpEmpty({ setup, setupFailed, onRetrySetup }: McpSetupProps) {
  const t = useTranslations("geo.pages.mcp.setup");
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={McpServerIcon} />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl items-stretch text-left">
        <McpSetup
          onRetrySetup={onRetrySetup}
          setup={setup}
          setupFailed={setupFailed}
        />
      </EmptyContent>
    </Empty>
  );
}
