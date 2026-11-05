"use client";

import { useTranslations } from "use-intl";

import { EmptyStateTrafficPreview } from "@/components/empty-state-preview";
import { McpSetup } from "@/components/mcp/mcp-setup";
import type { McpSetupProps } from "@/types/mcp-analytics";

/** Same layout as the website empty state: ghost preview, title, install card. */
export function McpEmpty({ setup, setupFailed, onRetrySetup }: McpSetupProps) {
  const t = useTranslations("geo.pages.mcp.setup");
  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-3 select-none sm:px-4 sm:pt-4"
      >
        <div className="mask-[linear-gradient(to_bottom,black_0%,transparent_75%)] opacity-20">
          <EmptyStateTrafficPreview />
        </div>
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-8 pb-4 text-center">
        <h3 className="text-lg font-semibold text-balance">{t("title")}</h3>
        <p className="text-muted-foreground mt-1.5 max-w-md text-sm leading-relaxed text-pretty">
          {t("description")}
        </p>
        <div className="mt-6 w-full text-left">
          <McpSetup
            onRetrySetup={onRetrySetup}
            setup={setup}
            setupFailed={setupFailed}
          />
        </div>
      </div>
    </div>
  );
}
