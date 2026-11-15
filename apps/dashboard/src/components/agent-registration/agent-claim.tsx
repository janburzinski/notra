"use client";

import { ctaButtonVariants } from "@notra/ui/components/shared/cta-button";
import { useTranslations } from "use-intl";

import type { AgentClaimPageData } from "@/types/agent-registration";

export function AgentClaim({ data }: { data: AgentClaimPageData }) {
  const t = useTranslations("auth.agentClaim");

  if (data.status === "linked") {
    return (
      <div
        className="flex flex-col items-center gap-6 text-center"
        role="status"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {t("linked.title")}
          </h1>
          <p className="text-muted-foreground text-base text-pretty">
            {t("linked.description", { workspace: data.workspaceName })}
          </p>
        </div>
        <output className="border-border rounded-lg border px-6 py-4 font-mono text-3xl tracking-widest select-all">
          {data.userCode}
        </output>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("linked.hint")}
        </p>
      </div>
    );
  }

  const key = data.status === "no-workspace" ? "no-workspace" : data.reason;
  const href = data.status === "no-workspace" ? "/onboarding" : "/";

  return (
    <div className="flex flex-col items-center gap-6 text-center" role="status">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t(`${key}.title`)}
        </h1>
        <p className="text-muted-foreground text-base text-pretty">
          {t(`${key}.description`)}
        </p>
      </div>
      <a className={ctaButtonVariants()} href={href}>
        {t(`${key}.action`)}
      </a>
    </div>
  );
}
