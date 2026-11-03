"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import { ORPCError } from "@orpc/client";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GITHUB_LINK_LOCALIZED_ERROR_CODES } from "@/constants/github";
import {
  settleGitHubInstallationChoice,
  useGitHubInstallationPickerRequest,
} from "@/lib/integrations/github/installation-picker";

/** Offers installations the user already administers before sending them to GitHub. */
export function GitHubInstallationPicker() {
  const t = useTranslations("integrations.github.installationPicker");
  const request = useGitHubInstallationPickerRequest();
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const connect = async (installationId: string) => {
    if (!request) {
      return;
    }
    setConnectingId(installationId);
    try {
      await request.connect(installationId);
      settleGitHubInstallationChoice("connected");
    } catch (error) {
      toast.error(
        error instanceof ORPCError &&
          GITHUB_LINK_LOCALIZED_ERROR_CODES.has(error.code)
          ? error.message
          : t("linkFailed")
      );
    }
    setConnectingId(null);
  };

  return (
    <ResponsiveDialog
      onOpenChange={(open) => {
        if (!(open || connectingId)) {
          settleGitHubInstallationChoice(null);
        }
      }}
      open={request !== null}
    >
      <ResponsiveDialogContent className="sm:max-w-[440px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ul className="divide-y rounded-xl border">
          {request?.installations.map((installation) => (
            <li
              className="flex h-14 items-center gap-3 px-3"
              key={installation.installationId}
            >
              <Avatar className="size-8 shrink-0">
                <AvatarImage alt="" src={installation.accountAvatarUrl} />
                <AvatarFallback>
                  {installation.accountLogin.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {installation.accountLogin}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {installation.accountType === "Organization"
                    ? t("organization")
                    : t("personal")}
                </span>
              </span>
              <Button
                aria-label={t("connectAccount", {
                  account: installation.accountLogin,
                })}
                disabled={
                  connectingId !== null &&
                  connectingId !== installation.installationId
                }
                loading={connectingId === installation.installationId}
                onClick={() => connect(installation.installationId)}
                size="sm"
              >
                {t("connect")}
              </Button>
            </li>
          ))}
        </ul>
        <ResponsiveDialogFooter>
          <Button
            disabled={connectingId !== null}
            onClick={() => settleGitHubInstallationChoice("new")}
            variant="outline"
          >
            {t("installElsewhere")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
