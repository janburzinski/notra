import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { GITHUB_CALLBACK_ERROR_MESSAGE_KEYS } from "@/constants/github";
import {
  hasAttemptedGitHubReauthorization,
  markGitHubReauthorizationAttempted,
  reauthorizeGitHub,
  startGitHubInstall,
} from "@/lib/integrations/github/install";
import type { GitHubInstallResumeParams } from "@/types/integrations/github-settings";

export function useGitHubCallbackErrorToast() {
  const t = useTranslations("integrations.github.callbackErrors");
  const tShared = useTranslations("integrations.shared");
  const [{ githubError: errorCode }, setParams] = useQueryStates(
    { githubError: parseAsString },
    { history: "replace" }
  );
  const handledErrorRef = useRef(false);
  useEffect(() => {
    if (!errorCode || handledErrorRef.current) {
      return;
    }
    handledErrorRef.current = true;
    void setParams({ githubError: null });
    toast.error(
      errorCode === "forbidden"
        ? tShared("youDoNotHaveAccess")
        : t(GITHUB_CALLBACK_ERROR_MESSAGE_KEYS[errorCode] ?? "callbackFailed")
    );
  }, [errorCode, setParams, t, tShared]);
}

/**
 * GitHub returns here after an org member who is not an owner requests the
 * app. Keeps the notice until dismissed so the page can explain what happens next.
 */
export function useGitHubInstallRequested() {
  const [{ githubInstallRequested }, setParams] = useQueryStates(
    { githubInstallRequested: parseAsBoolean },
    { history: "replace" }
  );
  const [requested, setRequested] = useState(githubInstallRequested === true);
  useEffect(() => {
    if (githubInstallRequested) {
      void setParams({ githubInstallRequested: null });
    }
  }, [githubInstallRequested, setParams]);
  return { requested, dismiss: () => setRequested(false) };
}

export function useResumeGitHubInstall(params: GitHubInstallResumeParams) {
  const t = useTranslations("integrations.github.toasts");
  const [
    {
      githubAccountConnected: shouldResume,
      githubReauthorizeInstallationId: reauthorizationInstallationId,
      githubReauthorizeState: reauthorizationState,
    },
    setParams,
  ] = useQueryStates(
    {
      githubAccountConnected: parseAsBoolean,
      githubReauthorizeInstallationId: parseAsString,
      githubReauthorizeState: parseAsString,
    },
    { history: "replace" }
  );
  const resumedInstallRef = useRef(false);
  // Finding linkable installations takes a moment after returning from GitHub.
  const [resuming, setResuming] = useState(shouldResume === true);
  useEffect(() => {
    if (
      (!shouldResume &&
        !(reauthorizationInstallationId && reauthorizationState)) ||
      !params.organizationId ||
      resumedInstallRef.current
    ) {
      return;
    }
    resumedInstallRef.current = true;
    void setParams({
      githubAccountConnected: null,
      githubReauthorizeInstallationId: null,
      githubReauthorizeState: null,
    });
    if (reauthorizationInstallationId && reauthorizationState) {
      if (hasAttemptedGitHubReauthorization(reauthorizationState)) {
        toast.error(t("reconnectFailedRetry"));
        return;
      }
      markGitHubReauthorizationAttempted(reauthorizationState);
      const callbackUrl = new URL(
        "/api/integrations/github/callback",
        window.location.origin
      );
      callbackUrl.searchParams.set(
        "installation_id",
        reauthorizationInstallationId
      );
      callbackUrl.searchParams.set("state", reauthorizationState);
      reauthorizeGitHub(
        `${callbackUrl.pathname}${callbackUrl.search}`,
        params.callbackPath
      ).then((started) => {
        if (!started) {
          toast.error(t("reconnectFailed"));
        }
      });
      return;
    }
    startGitHubInstall({
      organizationId: params.organizationId,
      callbackPath: params.callbackPath,
      allowAccountConnection: false,
      onPickerOpen: () => setResuming(false),
    }).then((result) => {
      if (result.started) {
        return;
      }
      setResuming(false);
      if (result.reason === "cancelled") {
        return;
      }
      toast.error(
        result.reason === "account-connection-incomplete"
          ? t("accountConnectionIncomplete")
          : t("resumeFailed")
      );
    });
  }, [
    params.callbackPath,
    params.organizationId,
    reauthorizationInstallationId,
    reauthorizationState,
    shouldResume,
    setParams,
    t,
  ]);

  return { resuming };
}
