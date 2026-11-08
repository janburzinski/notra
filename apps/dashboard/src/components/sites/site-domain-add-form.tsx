"use client";

import { Globe02Icon, Link01Icon } from "@hugeicons/core-free-icons";
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
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useId } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { SITE_DOMAIN_URL_SCHEME_PATTERN } from "@/constants/sites";
import { useInvalidateSites } from "@/lib/hooks/use-sites";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  SiteDomainAddFormProps,
  SiteDomainAddFormValues,
} from "@/types/components/sites";
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

  const addMutation = useMutation({
    mutationFn: (input: { kind: SiteDomainKind; value: string }) =>
      dashboardOrpc.sites.domains.add.call({
        organizationId,
        siteId,
        ...input,
      }),
    onSuccess: async (added, input) => {
      // acme.com/blog is added as www.acme.com/blog when acme.com forwards there.
      const typed = input.value
        .replace(SITE_DOMAIN_URL_SCHEME_PATTERN, "")
        .split("/")[0]
        ?.toLowerCase();
      const movedToTwin =
        typed !== undefined &&
        (added.hostname === `www.${typed}` ||
          typed === `www.${added.hostname}`);
      toast.success(
        movedToTwin
          ? t("addedAsTwin", { typed, hostname: added.hostname })
          : t("added")
      );
      form.reset();
      onAdded?.();
      await invalidateSites();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, t("addFailed")));
    },
  });

  const defaultValues: SiteDomainAddFormValues = { value: "", override: null };
  const form = useForm({
    defaultValues,
    onSubmit: ({ value: values }) => {
      const value = values.value.trim();
      const detectedKind = detectSiteDomainKind(value);
      if (detectedKind && !addMutation.isPending) {
        addMutation.mutate({ kind: values.override ?? detectedKind, value });
      }
    },
  });
  const { value, override } = useStore(form.store, (state) => state.values);
  const trimmed = value.trim();
  const detected = detectSiteDomainKind(trimmed);
  const kind = detected ? (override ?? detected) : null;
  const hostname = trimmed.split("/")[0] ?? "";
  const urls = mountedPaths(mounts).map((path) =>
    path === "/" ? hostname : `${hostname}${path}`
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
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
                form.setFieldValue("override", null);
              }
              form.setFieldValue("value", next);
            }}
            placeholder={t("placeholder")}
            spellCheck={false}
            value={value}
          />
        </InputGroup>
      </Field>
      <div
        aria-live="polite"
        className="border-border bg-background/60 rounded-lg border text-sm empty:hidden"
        id={`${id}-connection`}
      >
        {kind ? (
          <div
            className="animate-in fade-in duration-normal ease-emphasized divide-border divide-y"
            key={kind}
          >
            <div className="space-y-1.5 px-3.5 py-3">
              <p className="text-muted-foreground text-xs font-medium">
                {t("liveAt")}
              </p>
              <ul className="space-y-1">
                {urls.map((url) => (
                  <li className="flex min-w-0 items-center gap-2" key={url}>
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="text-muted-foreground shrink-0"
                      icon={Link01Icon}
                      size={14}
                      strokeWidth={1.5}
                    />
                    <span className="truncate font-mono text-sm">
                      <span className="text-muted-foreground">https://</span>
                      {url}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-muted-foreground px-3.5 py-3 text-pretty">
              {kind === "subdomain"
                ? t("subdomainExplain", { hostname })
                : t("proxyExplain", { hostname })}{" "}
              <button
                className="text-primary focus-visible:ring-ring/50 rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2"
                onClick={() =>
                  form.setFieldValue(
                    "override",
                    kind === "subdomain" ? "proxy" : "subdomain"
                  )
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
