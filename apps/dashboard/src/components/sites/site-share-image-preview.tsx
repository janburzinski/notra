"use client";

import {
  Alert02Icon,
  ArrowExpand01Icon,
  ImageNotFound01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@notra/ui/components/ui/dialog";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { SiteSettingsList } from "@/components/sites/site-settings-item";
import { useSiteSharePreview } from "@/lib/hooks/use-site-share-preview";
import { cn } from "@/lib/utils";
import type {
  SiteSharePreviewBodyProps,
  SiteSharePreviewImageProps,
  SiteSharePreviewPage,
  SiteSharePreviewProps,
  SiteSharePreviewWarningsProps,
} from "@/types/site-share-image";

function PreviewMessage({ children }: { children: string }) {
  return (
    <div className="text-muted-foreground flex size-full items-center justify-center p-4 text-center text-xs text-balance">
      {children}
    </div>
  );
}

/** The preview at its own size; a click opens it at full width. */
function PreviewImage({ src, alt }: SiteSharePreviewImageProps) {
  const t = useTranslations("sites.design.shareImages.preview");
  const [open, setOpen] = useState(false);
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <button
            aria-label={t("enlarge")}
            className="group/preview focus-visible:ring-ring/50 relative block size-full cursor-zoom-in outline-none focus-visible:ring-2"
            type="button"
          />
        }
      >
        <img
          alt={alt}
          className="size-full object-cover"
          height={630}
          src={src}
          width={1200}
        />
        <span className="bg-background/85 absolute right-2 bottom-2 flex size-6 items-center justify-center rounded-md opacity-0 shadow-sm transition-opacity group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100">
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5"
            icon={ArrowExpand01Icon}
            strokeWidth={2}
          />
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogTitle>{t("title")}</DialogTitle>
        <img
          alt={alt}
          className="ring-foreground/10 block h-auto w-full rounded-lg ring-1"
          height={630}
          src={src}
          width={1200}
        />
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ form, preview }: SiteSharePreviewBodyProps) {
  const t = useTranslations("sites.design.shareImages.preview");
  const { query, shown, homeImage } = preview;
  const image = query.data?.image;
  if (!shown) {
    return (
      <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-balance">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-5"
          icon={ImageNotFound01Icon}
          strokeWidth={1.75}
        />
        {t("off")}
      </div>
    );
  }
  if (image) {
    return (
      <PreviewImage
        alt={(homeImage && form.shareImageAlt) || t("alt")}
        src={image}
      />
    );
  }
  if (query.data) {
    return (
      <PreviewMessage>
        {homeImage ? t("missingHome") : t("invalid")}
      </PreviewMessage>
    );
  }
  if (query.isError) {
    return <PreviewMessage>{t("failed")}</PreviewMessage>;
  }
  return <Skeleton className="size-full rounded-none" />;
}

function PreviewWarnings({ warnings }: SiteSharePreviewWarningsProps) {
  const t = useTranslations("sites.design.shareImages.preview");
  if (warnings.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-1.5">
      {warnings.map((warning) => (
        <li
          className="text-muted-foreground flex items-start gap-2 text-sm text-pretty"
          key={warning}
        >
          <HugeiconsIcon
            aria-hidden="true"
            className="text-warning mt-0.5 size-4 shrink-0"
            icon={Alert02Icon}
            strokeWidth={1.75}
          />
          {t(`warnings.${warning}`)}
        </li>
      ))}
    </ul>
  );
}

/** The share image the next build draws, rendered by the same code on the server. */
export function SiteShareImagePreview({ form }: SiteSharePreviewProps) {
  const t = useTranslations("sites.design.shareImages.preview");
  const [page, setPage] = useState<SiteSharePreviewPage>("post");
  const preview = useSiteSharePreview(form, page);
  const { query, shown, homeImage } = preview;
  let caption = t("captionPost");
  if (page === "home") {
    caption = homeImage ? t("captionHomeImage") : t("captionHome");
  }
  return (
    <SiteSettingsList>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:gap-5 sm:p-5">
        {/* As tall as the image: text at its top, the page tabs at its bottom. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium">{t("title")}</h2>
            <p className="text-muted-foreground text-sm text-pretty">
              {caption}
            </p>
          </div>
          <PreviewWarnings
            warnings={shown ? (query.data?.warnings ?? []) : []}
          />
          <Tabs
            className="sm:mt-auto"
            onValueChange={(value) => {
              if (value === "post" || value === "home") {
                setPage(value);
              }
            }}
            value={page}
          >
            <TabsList aria-label={t("pageLabel")}>
              <TabsTrigger value="post">{t("pages.post")}</TabsTrigger>
              <TabsTrigger value="home">{t("pages.home")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div
          aria-busy={query.isFetching}
          className={cn(
            "bg-muted/40 relative aspect-[1200/630] w-full shrink-0 self-start overflow-hidden rounded-lg sm:w-80",
            "ring-foreground/10 ring-1"
          )}
        >
          <PreviewBody form={form} preview={preview} />
          {shown && query.isFetching && query.data?.image ? (
            <span className="bg-background/80 absolute top-2 right-2 flex size-6 items-center justify-center rounded-full shadow-sm">
              <Spinner className="size-3" />
              <span className="sr-only">{t("updating")}</span>
            </span>
          ) : null}
        </div>
      </div>
    </SiteSettingsList>
  );
}
