"use client";

import {
  Add01Icon,
  ArrowUpRight01Icon,
  Delete02Icon,
  FileImportIcon,
  LayoutTwoColumnIcon,
  PencilEdit02Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import { SiteAuthorAvatar } from "@/components/sites/site-author-avatar";
import { SiteAuthorDialog } from "@/components/sites/site-author-dialog";
import { SiteAuthorImportDialog } from "@/components/sites/site-author-import-dialog";
import { SiteAuthorPageLayoutPicker } from "@/components/sites/site-author-page-layout";
import { useSite } from "@/components/sites/site-context";
import { SiteDesignError } from "@/components/sites/site-design-error";
import {
  SiteSettingsBlock,
  SiteSettingsGroup,
  SiteSettingsItem,
  SiteSettingsList,
} from "@/components/sites/site-settings-item";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { useContentAuthors } from "@/lib/hooks/use-content-authors";
import { useSiteAuthorEditor } from "@/lib/hooks/use-site-author-editor";
import { useSiteAuthorUsage } from "@/lib/hooks/use-site-author-usage";
import { prepareSiteAuthorImport } from "@/lib/upload/site-author-import";
import type {
  SiteAuthorDeleteDialogProps,
  SiteAuthorEntry,
  SiteAuthorImport,
  SiteAuthorImportRowProps,
  SiteAuthorPagesProps,
  SiteAuthorRowProps,
  SiteAuthorsEmptyProps,
  SiteDesignAuthorsBodyProps,
} from "@/types/site-authors";
import type { SiteRawConfig } from "@/types/site-design";
import {
  readSiteAuthors,
  removeSiteAuthor,
  setSiteAuthorPageLayout,
  siteAuthorPageLayout,
  siteAuthorPagesPath,
  siteAuthorPageUrl,
  writeSiteAuthor,
} from "@/utils/site-authors";

function SiteAuthorRow({
  entry,
  pageUrl,
  usage,
  onEdit,
  onDelete,
}: SiteAuthorRowProps) {
  const t = useTranslations("sites.design.authors");
  const { name, title, avatar } = entry.author;
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 sm:gap-4 sm:px-5">
      <SiteAuthorAvatar avatar={avatar} className="size-9" name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
          {title ? <span className="truncate">{title}</span> : null}
          {title ? <span aria-hidden="true">·</span> : null}
          <span className="truncate font-mono">{entry.id}</span>
        </p>
      </div>
      {usage ? (
        <span className="text-muted-foreground hidden shrink-0 text-xs tabular-nums sm:inline">
          {t("posts", { count: usage })}
        </span>
      ) : null}
      <div className="flex shrink-0 items-center gap-0.5">
        {pageUrl ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  aria-label={t("viewPageLabel", { name })}
                  className={buttonVariants({
                    size: "icon-sm",
                    variant: "ghost",
                  })}
                  href={pageUrl}
                  rel="noreferrer"
                  target="_blank"
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={ArrowUpRight01Icon}
                strokeWidth={1.8}
              />
            </TooltipTrigger>
            <TooltipContent>{t("viewPage")}</TooltipContent>
          </Tooltip>
        ) : null}
        <Button
          aria-label={t("edit", { name })}
          onClick={onEdit}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={PencilEdit02Icon}
            strokeWidth={1.8}
          />
        </Button>
        <Button
          aria-label={t("delete", { name })}
          onClick={onDelete}
          size="icon-sm"
          variant="ghost"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={Delete02Icon}
            strokeWidth={1.8}
          />
        </Button>
      </div>
    </div>
  );
}
function SiteAuthorsEmpty({ onAdd }: SiteAuthorsEmptyProps) {
  const t = useTranslations("sites.design.authors");
  return (
    <div className="flex flex-col items-center gap-3 border-b px-6 py-10 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-5"
          icon={UserMultiple02Icon}
          strokeWidth={1.75}
        />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("emptyTitle")}</p>
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">
          {t("emptyDescription")}
        </p>
      </div>
      <Button onClick={onAdd} size="sm" type="button">
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={Add01Icon}
        />
        {t("add")}
      </Button>
    </div>
  );
}

function SiteAuthorImportRow({ count, onOpen }: SiteAuthorImportRowProps) {
  const t = useTranslations("sites.design.authors");
  return (
    <SiteSettingsList>
      <SiteSettingsItem
        description={t("importHint", { count })}
        icon={FileImportIcon}
        title={t("importTitle")}
        value={
          <div className="flex justify-end">
            <Button onClick={onOpen} size="sm" type="button" variant="outline">
              {t("importButton")}
            </Button>
          </div>
        }
      />
    </SiteSettingsList>
  );
}

function SiteAuthorPagesBlock({ blogMount, onChange }: SiteAuthorPagesProps) {
  const t = useTranslations("sites.design.authors.pageLayout");
  const state = useSiteWorkspace();
  if (!state) {
    return null;
  }
  return (
    <SiteSettingsList>
      <SiteSettingsBlock
        description={t("description", {
          path: siteAuthorPagesPath(blogMount),
        })}
        errorPath="blog.authorPage"
        icon={LayoutTwoColumnIcon}
        title={t("title")}
      >
        <SiteAuthorPageLayoutPicker
          onChange={(layout) =>
            onChange(
              setSiteAuthorPageLayout(state.config, state.published, layout)
            )
          }
          value={siteAuthorPageLayout(state.config)}
        />
      </SiteSettingsBlock>
    </SiteSettingsList>
  );
}

function SiteAuthorDeleteDialog({
  entry,
  usage,
  onConfirm,
  onClose,
}: SiteAuthorDeleteDialogProps) {
  const t = useTranslations("sites.design.authors.deleteDialog");
  const id = entry?.id ?? "";
  return (
    <ConfirmDialog
      confirmLabel={t("confirm")}
      description={
        usage === null ? t("unknown", { id }) : t("used", { id, count: usage })
      }
      onConfirm={onConfirm}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={entry !== null}
      title={t("title", { name: entry?.author.name ?? "" })}
      variant="destructive"
    />
  );
}

/**
 * blog.json `authors` and `blog.authorPage`. Edits go into the site's
 * blog.json draft like every other Design section and go live on publish.
 */
export function SiteDesignAuthors() {
  const state = useSiteWorkspace();
  return state ? <SiteDesignAuthorsBody state={state} /> : null;
}

function SiteDesignAuthorsBody({ state }: SiteDesignAuthorsBodyProps) {
  const t = useTranslations("sites.design.authors");
  const { organizationId, detail } = useSite();
  const usage = useSiteAuthorUsage();
  const { authors: contentAuthors } = useContentAuthors(organizationId);
  const editor = useSiteAuthorEditor();
  const [deleting, setDeleting] = useState<SiteAuthorEntry | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  });
  const authors = readSiteAuthors(state.config);
  const ids = new Set(authors.map((entry) => entry.id));
  const publishedIds = new Set(
    readSiteAuthors(state.published).map((entry) => entry.id)
  );
  const importable = contentAuthors.filter((author) => !ids.has(author.slug));
  const blogMount = detail.site.mounts.blog;
  const pageUrl = (id: string) =>
    detail.site.liveDeploymentId && blogMount && publishedIds.has(id)
      ? siteAuthorPageUrl(detail.site.publicOrigin, blogMount, id)
      : null;
  const change = (next: SiteRawConfig) => {
    if (!state.readOnly) {
      state.update(next);
    }
  };

  const importAuthors = async (imports: SiteAuthorImport[]) => {
    const { entries, failedAvatars } = await prepareSiteAuthorImport(
      imports,
      state
    );
    for (const name of failedAvatars) {
      toast.error(t("importDialog.avatarFailed", { name }));
    }
    // The avatar copies re-render the workspace; write onto its latest state.
    const current = latest.current;
    if (!current.readOnly) {
      current.update(
        entries.reduce(
          (config, entry) => writeSiteAuthor(config, null, entry),
          current.config
        )
      );
    }
    toast.success(t("importDialog.imported", { count: entries.length }));
  };

  const editingEntry = editor.editing === "new" ? null : editor.editing;

  return (
    <div className="space-y-8">
      <SiteSettingsGroup
        action={
          authors.length > 0 ? (
            <Button
              onClick={() => editor.open("new")}
              size="sm"
              type="button"
              variant="outline"
            >
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-start"
                icon={Add01Icon}
              />
              {t("add")}
            </Button>
          ) : null
        }
        icon={UserMultiple02Icon}
        title={t("listTitle")}
      >
        {importable.length > 0 ? (
          <SiteAuthorImportRow
            count={importable.length}
            onOpen={() => setImportOpen(true)}
          />
        ) : null}
        <SiteSettingsList>
          {authors.length === 0 ? (
            <SiteAuthorsEmpty onAdd={() => editor.open("new")} />
          ) : (
            authors.map((entry) => (
              <SiteAuthorRow
                entry={entry}
                key={entry.id}
                onDelete={() => setDeleting(entry)}
                onEdit={() => editor.open(entry)}
                pageUrl={pageUrl(entry.id)}
                usage={usage(entry.id)}
              />
            ))
          )}
        </SiteSettingsList>
        <SiteDesignError path="authors" />
      </SiteSettingsGroup>

      {blogMount ? (
        <SiteAuthorPagesBlock blogMount={blogMount} onChange={change} />
      ) : null}

      {editor.editing ? (
        <SiteAuthorDialog
          entry={editingEntry}
          key={editingEntry?.id ?? "new"}
          onOpenChange={(open) => {
            if (!open) {
              editor.close();
            }
          }}
          onSave={(previousId, entry) =>
            change(writeSiteAuthor(state.config, previousId, entry))
          }
          open
          published={Boolean(editingEntry && publishedIds.has(editingEntry.id))}
          takenIds={new Set([...ids].filter((id) => id !== editingEntry?.id))}
          usage={editingEntry ? usage(editingEntry.id) : 0}
        />
      ) : null}

      {importOpen ? (
        <SiteAuthorImportDialog
          authors={contentAuthors}
          onImport={importAuthors}
          onOpenChange={setImportOpen}
          open
          siteIds={ids}
        />
      ) : null}

      <SiteAuthorDeleteDialog
        entry={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            change(removeSiteAuthor(state.config, deleting.id));
          }
          setDeleting(null);
        }}
        usage={deleting ? usage(deleting.id) : null}
      />
    </div>
  );
}
