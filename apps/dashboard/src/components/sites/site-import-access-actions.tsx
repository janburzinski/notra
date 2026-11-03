"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import { useRefreshImportableRepositories } from "@/lib/hooks/use-importable-repositories";
import type { SiteImportAccessActionsProps } from "@/types/components/sites";

const externalIcon = (
  <HugeiconsIcon aria-hidden="true" icon={ArrowUpRight01Icon} size={13} />
);

/**
 * Linked accounts change access on GitHub and reload the list on return;
 * connecting another account goes through the install picker.
 */
export function SiteImportAccessActions({
  organizationId,
  account,
  installing,
  onInstall,
}: SiteImportAccessActionsProps) {
  const t = useTranslations("sites.new");
  const refresh = useRefreshImportableRepositories(organizationId);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const { mutate: refreshRepositories } = refresh;

  useEffect(() => {
    if (!awaitingReturn) {
      return;
    }
    const onFocus = () => {
      setAwaitingReturn(false);
      refreshRepositories(undefined, {
        onError: (error) =>
          toast.error(error.message || t("repositoriesLoadFailedDescription")),
      });
    };
    window.addEventListener("focus", onFocus, { once: true });
    return () => window.removeEventListener("focus", onFocus);
  }, [awaitingReturn, refreshRepositories, t]);

  if (!account) {
    return (
      <Button
        loading={installing}
        onClick={onInstall}
        size="sm"
        type="button"
        variant="link"
      >
        {t("adjustAccess")}
        {externalIcon}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <a
        className={buttonVariants({ size: "sm", variant: "link" })}
        href={account.installationSettingsUrl}
        onClick={() => setAwaitingReturn(true)}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t("adjustAccess")}
        {externalIcon}
      </a>
      <Button
        loading={installing}
        onClick={onInstall}
        size="sm"
        type="button"
        variant="link"
      >
        {t("connectAnotherAccount")}
      </Button>
    </div>
  );
}
