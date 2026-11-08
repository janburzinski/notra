"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Checkbox } from "@notra/ui/components/ui/checkbox";
import { cn } from "@notra/ui/lib/utils";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ContentAuthorAvatar } from "@/components/content/overview/overview-author-select";
import type { SiteAuthorImportDialogProps } from "@/types/site-authors";
import { siteAuthorImports } from "@/utils/site-authors";

export function SiteAuthorImportDialog({
  open,
  onOpenChange,
  authors,
  siteIds,
  onImport,
}: SiteAuthorImportDialogProps) {
  const t = useTranslations("sites.design.authors.importDialog");
  const id = useId();
  const imports = siteAuthorImports(authors, siteIds);
  const [selected, setSelected] = useState(
    () => new Set(imports.filter((item) => !item.exists).map((item) => item.id))
  );
  const [pending, setPending] = useState(false);
  const chosen = imports.filter(
    (item) => !item.exists && selected.has(item.id)
  );

  return (
    <ResponsiveDialog
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:max-w-lg">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ul
          aria-label={t("listLabel")}
          className="scrollbar-floating mt-2 min-h-0 divide-y overflow-y-auto rounded-xl border"
        >
          {imports.map((item) => {
            const rowId = `${id}-${item.id}`;
            const avatarUrl = item.author.avatar ?? item.avatarUpload;
            return (
              <li
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5",
                  item.exists && "opacity-60"
                )}
                key={item.id}
              >
                <Checkbox
                  aria-describedby={`${rowId}-detail`}
                  checked={!item.exists && selected.has(item.id)}
                  disabled={item.exists || pending}
                  id={rowId}
                  onCheckedChange={(checked) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (checked) {
                        next.add(item.id);
                      } else {
                        next.delete(item.id);
                      }
                      return next;
                    })
                  }
                />
                <ContentAuthorAvatar
                  author={{ name: item.author.name, avatarUrl }}
                  className="size-8"
                />
                <label
                  className={cn(
                    "min-w-0 flex-1 space-y-0.5",
                    !item.exists && "cursor-pointer"
                  )}
                  htmlFor={rowId}
                >
                  <span className="block truncate text-sm font-medium">
                    {item.author.name}
                  </span>
                  <span
                    className="text-muted-foreground block truncate text-xs"
                    id={`${rowId}-detail`}
                  >
                    {item.exists ? (
                      t("exists", { id: item.id })
                    ) : (
                      <>
                        {item.author.title ? `${item.author.title} · ` : null}
                        <span className="font-mono">{item.id}</span>
                      </>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground mt-1 mb-2 shrink-0 text-xs leading-relaxed text-pretty">
          {t("note")}
        </p>
        <ResponsiveDialogFooter className="shrink-0">
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            {t("cancel")}
          </Button>
          <Button
            data-dialog-confirm
            disabled={chosen.length === 0 || pending}
            onClick={() => {
              setPending(true);
              void onImport(chosen)
                .then(() => onOpenChange(false))
                .finally(() => setPending(false));
            }}
            type="button"
          >
            {t("submit", { count: chosen.length })}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
