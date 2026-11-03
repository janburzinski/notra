"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { startGitHubInstall } from "@/lib/integrations/github/install";

/** Starts the GitHub App install or account picker from a Sites repository list. */
export function useSiteGitHubInstall(params: {
  organizationId: string;
  callbackPath: string;
}) {
  const t = useTranslations("sites.new");
  const [installing, setInstalling] = useState(false);

  const install = async () => {
    setInstalling(true);
    const result = await startGitHubInstall(params);
    if (result.started) {
      return;
    }
    setInstalling(false);
    if (result.reason === "cancelled") {
      return;
    }
    toast.error(
      result.reason === "install-start-failed" && result.message
        ? result.message
        : t("installFailed")
    );
  };

  return { installing, install };
}
