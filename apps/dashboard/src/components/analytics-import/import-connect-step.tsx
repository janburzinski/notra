"use client";

import { ResponsiveDialogFooter } from "@notra/ui/components/shared/responsive-dialog";
import { Input } from "@notra/ui/components/ui/input";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GeoExternalLinkButton } from "@/components/geo/geo-external-link-button";
import { GeoSetupStep } from "@/components/geo/geo-setup-step";
import {
  ANALYTICS_IMPORT_CLOUDFLARE_PERMISSIONS,
  ANALYTICS_IMPORT_MIN_SECRET_LENGTH,
  ANALYTICS_IMPORT_PROVIDER_BRANDS,
  ANALYTICS_IMPORT_PROVIDER_URLS,
} from "@/constants/analytics-imports";
import { useAnalyticsImportMutations } from "@/lib/hooks/use-analytics-imports";
import type { ImportConnectStepProps } from "@/types/components/analytics-import";
import { toErrorMessage } from "@/utils/error-message";

import { ImportProviderLogo } from "./import-provider-mark";
import { ImportSavedConnections } from "./import-saved-connections";

export function ImportConnectStep({
  organizationId,
  canManage,
  provider,
  connections,
  reconnectId,
  onConnected,
}: ImportConnectStepProps) {
  const t = useTranslations("geo.analyticsImport");
  const formId = useId();
  const secretId = useId();
  const teamId = useId();
  const [secret, setSecret] = useState("");
  const [team, setTeam] = useState("");
  const { connect } = useAnalyticsImportMutations(organizationId);
  const name = ANALYTICS_IMPORT_PROVIDER_BRANDS[provider];
  const saved = reconnectId
    ? []
    : connections.filter(
        (connection) =>
          connection.provider === provider && connection.status === "active"
      );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    connect.mutate(
      {
        provider,
        secret: secret.trim(),
        ...(provider === "vercel" && team.trim()
          ? { teamId: team.trim() }
          : {}),
        ...(reconnectId ? { connectionId: reconnectId } : {}),
      },
      {
        onSuccess: ({ connection }) => {
          setSecret("");
          onConnected(connection.id);
        },
        onError: (error) =>
          toast.error(toErrorMessage(error, t("connect.failed"))),
      }
    );
  };

  return (
    <>
      <form
        className="flex min-w-0 flex-col gap-5"
        id={formId}
        onSubmit={submit}
      >
        {saved.length > 0 ? (
          <ImportSavedConnections
            canManage={canManage}
            connections={saved}
            onSelect={onConnected}
          />
        ) : null}
        {canManage ? null : (
          <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 text-xs text-pretty">
            {t("connect.managersOnly")}
          </p>
        )}
        {canManage ? (
          <ol aria-label={t("guide", { provider: name })}>
            <GeoSetupStep
              plain
              description={t(`connect.steps.${provider}.firstDescription`)}
              index={1}
              title={t(`connect.steps.${provider}.firstTitle`)}
            >
              <div className="flex">
                <GeoExternalLinkButton
                  href={ANALYTICS_IMPORT_PROVIDER_URLS[provider]}
                  icon={
                    <ImportProviderLogo
                      className={
                        provider === "vercel" ? "size-3" : "h-3 w-auto"
                      }
                      provider={provider}
                    />
                  }
                  label={t("openProvider", { provider: name })}
                />
              </div>
            </GeoSetupStep>
            <GeoSetupStep
              plain
              description={t(`connect.steps.${provider}.secondDescription`)}
              index={2}
              title={t(`connect.steps.${provider}.secondTitle`)}
            >
              {provider === "cloudflare" ? (
                <ul className="border-table-card-border bg-table-card shadow-table-card flex flex-col gap-1 rounded-xl border px-3 py-2.5 font-mono text-xs">
                  {ANALYTICS_IMPORT_CLOUDFLARE_PERMISSIONS.map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              ) : null}
              {provider === "vercel" ? (
                <Input
                  aria-label={t("connect.teamLabel")}
                  autoComplete="off"
                  id={teamId}
                  onChange={(event) => setTeam(event.target.value)}
                  placeholder={t("connect.teamPlaceholder")}
                  spellCheck={false}
                  value={team}
                />
              ) : null}
            </GeoSetupStep>
            <GeoSetupStep
              plain
              index={3}
              title={
                provider === "plausible"
                  ? t("connect.pasteKey")
                  : t("connect.pasteToken")
              }
            >
              <Input
                aria-label={
                  provider === "plausible"
                    ? t("connect.secretLabel")
                    : t("connect.tokenLabel")
                }
                autoComplete="off"
                id={secretId}
                onChange={(event) => setSecret(event.target.value)}
                spellCheck={false}
                type="password"
                value={secret}
              />
            </GeoSetupStep>
          </ol>
        ) : null}
      </form>
      {canManage ? (
        <ResponsiveDialogFooter className="sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">{t("connect.stored")}</p>
          <Button
            disabled={secret.trim().length < ANALYTICS_IMPORT_MIN_SECRET_LENGTH}
            form={formId}
            loading={connect.isPending}
            type="submit"
          >
            {t("connect.submit")}
          </Button>
        </ResponsiveDialogFooter>
      ) : null}
    </>
  );
}
