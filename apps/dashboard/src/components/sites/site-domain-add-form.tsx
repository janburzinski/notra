"use client";

import { Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { SITE_DOMAIN_URL_SCHEME_PATTERN } from "@/constants/sites";
import { useInvalidateSites } from "@/lib/hooks/use-sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDomainAddFormProps } from "@/types/components/sites";
import type { SiteDomainKind } from "@/types/sites";
import { toErrorMessage } from "@/utils/error-message";
import { detectSiteDomainKind } from "@/utils/site-domains";
import { mountedPaths } from "@/utils/site-proxy-recipes";

export function SiteDomainAddForm({
  organizationId,
  siteId,
  mounts,
  autoFocus = false,
  onAdded,
  renderActions,
}: SiteDomainAddFormProps) {
  const t = useTranslations("sites.domainsPage.add");
  const id = useId();
  const invalidateSites = useInvalidateSites();
  const [value, setValue] = useState("");
  const [override, setOverride] = useState<SiteDomainKind | null>(null);
  const trimmed = value.trim();
  const detected = detectSiteDomainKind(trimmed);
  const kind = detected ? (override ?? detected) : null;
  const hostname = trimmed.split("/")[0] ?? "";
  const urls = mountedPaths(mounts).map((path) =>
    path === "/" ? hostname : `${hostname}${path}`
  );

  const addMutation = useMutation({
    mutationFn: (domainKind: SiteDomainKind) =>
      dashboardOrpc.sites.domains.add.call({
        organizationId,
        siteId,
        kind: domainKind,
        value: trimmed,
      }),
    onSuccess: async () => {
      toast.success(t("added"));
      setValue("");
      setOverride(null);
      onAdded?.();
      await invalidateSites();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, t("addFailed")));
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (kind && !addMutation.isPending) {
          addMutation.mutate(kind);
        }
      }}
    >
      <Field>
        <FieldContent>
          <FieldLabel htmlFor={`${id}-input`}>{t("label")}</FieldLabel>
          <FieldDescription id={`${id}-hint`}>{t("hint")}</FieldDescription>
        </FieldContent>
        <InputGroup>
          <InputGroupAddon>
            <HugeiconsIcon
              aria-hidden="true"
              icon={Globe02Icon}
              size={15}
              strokeWidth={1.5}
            />
          </InputGroupAddon>
          <InputGroupInput
            aria-describedby={`${id}-hint ${id}-connection`}
            autoCapitalize="none"
            autoComplete="off"
            autoFocus={autoFocus}
            id={`${id}-input`}
            inputMode="url"
            onChange={(event) => {
              const next = event.target.value.replace(
                SITE_DOMAIN_URL_SCHEME_PATTERN,
                ""
              );
              if (detectSiteDomainKind(next) !== detected) {
                setOverride(null);
              }
              setValue(next);
            }}
            placeholder={t("placeholder")}
            spellCheck={false}
            value={value}
          />
        </InputGroup>
      </Field>
      <div
        aria-live="polite"
        className="bg-muted/50 rounded-lg px-3.5 py-3 text-sm empty:hidden"
        id={`${id}-connection`}
      >
        {kind ? (
          <div
            className="animate-in fade-in duration-normal ease-emphasized space-y-2"
            key={kind}
          >
            <div className="space-y-0.5">
              <p className="text-muted-foreground text-xs">{t("liveAt")}</p>
              <ul>
                {urls.map((url) => (
                  <li className="truncate font-medium" key={url}>
                    {url}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-muted-foreground text-pretty">
              {kind === "subdomain"
                ? t("subdomainExplain", { hostname })
                : t("proxyExplain", { hostname })}{" "}
              <button
                className="text-primary focus-visible:ring-ring/50 rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2"
                onClick={() =>
                  setOverride(kind === "subdomain" ? "proxy" : "subdomain")
                }
                type="button"
              >
                {kind === "subdomain" ? t("useProxy") : t("useDns")}
              </button>
            </p>
          </div>
        ) : null}
      </div>
      {renderActions({
        canSubmit: kind !== null,
        pending: addMutation.isPending,
      })}
    </form>
  );
}
