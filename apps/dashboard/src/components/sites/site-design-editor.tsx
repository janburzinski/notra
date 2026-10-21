"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import { SiteBrandDialog } from "@/components/sites/site-brand-dialog";
import { useSite } from "@/components/sites/site-context";
import { SitePublishDialog } from "@/components/sites/site-publish-dialog";
import { useSiteBrandDefaults } from "@/lib/hooks/use-site-brand-defaults";
import {
  useSaveSiteConfigDraft,
  useSiteConfigDocument,
} from "@/lib/hooks/use-site-config-document";
import { useSitePublishFiles } from "@/lib/hooks/use-site-publish-files";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  SiteBrandHintProps,
  SiteDesignEditorProps,
  SiteDesignFormProps,
  SiteDesignSaveBarProps,
  SiteRawConfig,
} from "@/types/site-design";
import { toErrorMessage } from "@/utils/error-message";
import {
  parseSiteConfig,
  serializeSiteConfig,
  siteConfigIssue,
} from "@/utils/site-design";
import { siteHref } from "@/utils/site-links";

function readConfig(content: string): SiteRawConfig | null {
  try {
    return parseSiteConfig(content);
  } catch {
    return null;
  }
}

/** Loads blog.json and renders a form whose changes save as an editor draft. */
export function SiteDesignEditor<T>(props: SiteDesignEditorProps<T>) {
  const { organizationId, organizationSlug, siteId, detail } = useSite();
  const t = useTranslations("sites.design");
  const queryClient = useQueryClient();
  const query = useSiteConfigDocument();
  const publish = useSitePublishFiles({
    noDrafts: t("noDrafts"),
    failed: t("preparePublishFailed"),
  });
  if (query.isPending) {
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        {t("loading")}
      </p>
    );
  }
  if (query.isError) {
    return (
      <div className="space-y-3 text-sm">
        <p role="alert">{toErrorMessage(query.error, t("loadFailed"))}</p>
        <Button onClick={() => query.refetch()} type="button" variant="outline">
          {t("retry")}
        </Button>
      </div>
    );
  }
  const config = readConfig(query.data.content);
  if (!config) {
    return (
      <div className="space-y-3 text-sm">
        <p role="alert">{t("invalidConfig")}</p>
        <Link
          className="text-sm underline underline-offset-4"
          href={siteHref(organizationSlug, siteId, "editor")}
        >
          {t("openEditor")}
        </Link>
      </div>
    );
  }
  return (
    <>
      <SiteDesignForm
        {...props}
        config={config}
        document={query.data}
        key={`${siteId}:${query.data.content}:${query.data.draftRevision}`}
        onPublish={publish.open}
        preparingPublish={publish.preparing}
      />
      {publish.files ? (
        <SitePublishDialog
          draftCount={publish.files.drafts.length}
          drafts={publish.files.drafts}
          initialMessage={t("publishMessage")}
          onConflict={() => {
            publish.close();
            toast.error(t("publishConflict"));
          }}
          onOpenChange={(next) => {
            if (!next) {
              publish.close();
            }
          }}
          onPublished={() => {
            void queryClient.invalidateQueries({
              queryKey: dashboardOrpc.sites.key(),
            });
          }}
          open
          organizationId={organizationId}
          site={detail.site}
          siteId={siteId}
          sourcePaths={new Set(publish.files.files.map((file) => file.path))}
        />
      ) : null}
    </>
  );
}

function SiteBrandHint<T>({
  form,
  setForm,
  applyBrand,
  describeBrand,
}: SiteBrandHintProps<T>) {
  const t = useTranslations("sites.design");
  const brand = useSiteBrandDefaults();
  const [open, setOpen] = useState(false);
  if (!brand) {
    return null;
  }
  const changes = describeBrand(brand, form);
  return (
    <>
      {changes.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t("brandHint")}</span>
          <Button
            onClick={() => setOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("applyBrand")}
          </Button>
        </div>
      ) : null}
      <SiteBrandDialog
        changes={changes}
        onConfirm={() => {
          setForm(applyBrand(brand, form));
          setOpen(false);
        }}
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}

function SiteDesignSaveBar({
  dirty,
  error,
  saving,
  preparingPublish,
  onReset,
  onPublish,
}: SiteDesignSaveBarProps) {
  const t = useTranslations("sites.design");
  const busy = saving || preparingPublish;
  return (
    <div className="bg-background/95 supports-backdrop-filter:bg-background/80 shadow-lift sticky bottom-4 z-10 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-xl border py-2 pr-2 pl-3.5 backdrop-blur">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t(dirty ? "unsaved" : "draftPending")}
        </p>
      )}
      <div className="flex items-center gap-2">
        {dirty ? (
          <>
            <Button
              disabled={busy}
              onClick={onReset}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("reset")}
            </Button>
            <Button
              disabled={busy}
              loading={saving}
              size="sm"
              type="submit"
              variant="outline"
            >
              {t("saveDraft")}
            </Button>
          </>
        ) : null}
        <Button
          disabled={busy}
          loading={preparingPublish}
          onClick={onPublish}
          size="sm"
          type="button"
        >
          {t("publish")}
        </Button>
      </div>
    </div>
  );
}

function SiteDesignForm<T>({
  document,
  config,
  read,
  patch,
  children,
  applyBrand,
  describeBrand,
  onPublish,
  preparingPublish,
}: SiteDesignFormProps<T>) {
  const t = useTranslations("sites.design");
  const [initial] = useState(() => read(config));
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveSiteConfigDraft(document);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const submit = async (thenPublish: boolean) => {
    const next = patch(config, form, initial);
    const issue = siteConfigIssue(next);
    if (issue) {
      setError(t("invalidValue", { path: issue }));
      return;
    }
    setError(null);
    try {
      // Saving remounts this form, so follow-ups can't hang off mutate().
      await save.mutateAsync(serializeSiteConfig(next));
    } catch (cause) {
      setError(toErrorMessage(cause, t("saveFailed")));
      return;
    }
    if (thenPublish) {
      await onPublish();
    } else {
      toast.success(t("saved"));
    }
  };

  return (
    <form
      action={() => {
        if (dirty && !save.isPending) {
          void submit(false);
        }
      }}
      className="min-w-0 space-y-8"
    >
      <SiteBrandHint
        applyBrand={applyBrand}
        describeBrand={describeBrand}
        form={form}
        setForm={setForm}
      />
      <fieldset className="min-w-0 space-y-8" disabled={save.isPending}>
        {children(form, (key, value) => {
          setError(null);
          setForm((current) => ({ ...current, [key]: value }));
        })}
      </fieldset>
      {dirty || error || document.hasDraft ? (
        <SiteDesignSaveBar
          dirty={dirty}
          error={error}
          onPublish={() => {
            void (dirty ? submit(true) : onPublish());
          }}
          onReset={() => {
            setForm(initial);
            setError(null);
          }}
          preparingPublish={preparingPublish}
          saving={save.isPending}
        />
      ) : null}
    </form>
  );
}
