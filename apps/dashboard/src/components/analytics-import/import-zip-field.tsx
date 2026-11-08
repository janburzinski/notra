"use client";

import {
  FileUploadIcon,
  Delete02Icon,
  FileZipIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { IMPORT_CSV_MAX_ZIP_BYTES } from "@notra/geo-core/constants/analytics-imports";
import { Dropzone } from "@notra/ui/components/kibo-ui/dropzone";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { ANALYTICS_IMPORT_ZIP_ACCEPT } from "@/constants/analytics-imports";
import { cn } from "@/lib/utils";
import type {
  ImportZipChosenFileProps,
  ImportZipFieldError,
  ImportZipFieldProps,
  ImportZipPromptProps,
} from "@/types/components/analytics-import";
import {
  importZipRootProps,
  zipRejectionReason,
} from "@/utils/analytics-imports";
import { formatCsvFileSize } from "@/utils/geo-import";

/** Undoes the outline-button look the Dropzone root starts from. */
const ZONE_CLASS =
  "h-auto rounded-lg font-normal whitespace-normal shadow-none active:scale-100 transition-colors duration-fast ease-out";
const EMPTY_CLASS =
  "border-dashed bg-transparent px-6 py-6 hover:bg-muted/40 dark:bg-transparent dark:hover:bg-muted/40";
const SELECTED_CLASS =
  "bg-background p-0 hover:bg-background dark:bg-background dark:hover:bg-background items-stretch";
const DRAGGING_CLASS =
  "border-solid border-primary/50 bg-primary/5 ring-3 ring-primary/15 hover:bg-primary/5 dark:border-primary/50 dark:bg-primary/10 dark:hover:bg-primary/10";
const INVALID_CLASS = "border-destructive/50 dark:border-destructive/50";

/** The chosen export, with Replace (the drop zone's own click) and Remove. */
function ImportZipChosenFile({
  file,
  disabled,
  dragging,
  onRemove,
}: ImportZipChosenFileProps) {
  const t = useTranslations("geo.analyticsImport.csv");
  const locale = useLocale();
  return (
    <div className="flex w-full items-center gap-3 py-2 ps-3 pe-2 text-start">
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0"
        icon={FileZipIcon}
        strokeWidth={1.75}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{file.name}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {dragging
            ? t("dropReplace")
            : t("fileMeta", {
                size: formatCsvFileSize(file.size, locale),
              })}
        </span>
      </span>
      {/* Its click reaches the drop zone, which opens the file picker. */}
      <Button disabled={disabled} size="sm" type="button" variant="outline">
        <HugeiconsIcon
          aria-hidden="true"
          icon={FileUploadIcon}
          strokeWidth={1.75}
        />
        {t("replace")}
      </Button>
      <Button
        aria-label={t("remove", { name: file.name })}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Delete02Icon}
          strokeWidth={1.75}
        />
      </Button>
    </div>
  );
}

/** The empty drop zone: what to drop and the size limit. */
function ImportZipPrompt({
  dragging,
  titleId,
  hintId,
  maxSize,
}: ImportZipPromptProps) {
  const t = useTranslations("geo.analyticsImport.csv");
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "duration-fast size-4.5 transition-transform ease-out motion-reduce:transition-none",
          dragging ? "text-primary -translate-y-0.5" : "text-muted-foreground"
        )}
        icon={Upload01Icon}
        strokeWidth={1.75}
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-balance" id={titleId}>
          {dragging ? t("dropActive") : t("dropTitle")}
        </span>
        <span className="text-muted-foreground text-xs text-pretty" id={hintId}>
          {t("dropHint", { size: maxSize })}
        </span>
      </span>
    </div>
  );
}

export function ImportZipField({
  file,
  disabled,
  serverError,
  onChange,
}: ImportZipFieldProps) {
  const t = useTranslations("geo.analyticsImport.csv");
  const locale = useLocale();
  const [dragging, setDragging] = useState(false);
  // `count` re-announces the same error when it happens again.
  const [localError, setError] = useState<ImportZipFieldError | null>(null);
  const error = localError ?? serverError ?? null;
  const maxSize = formatCsvFileSize(IMPORT_CSV_MAX_ZIP_BYTES, locale);
  const labelId = useId();
  const titleId = useId();
  const hintId = useId();
  const errorId = useId();
  const showError = (text: string) =>
    setError((previous) => ({ text, count: (previous?.count ?? 0) + 1 }));

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium" id={labelId}>
          {t("fileLabel")}
        </p>
        <Dropzone
          accept={ANALYTICS_IMPORT_ZIP_ACCEPT}
          className={cn(
            ZONE_CLASS,
            file ? SELECTED_CLASS : EMPTY_CLASS,
            error && !dragging ? INVALID_CLASS : null,
            dragging ? DRAGGING_CLASS : null
          )}
          disabled={disabled}
          maxSize={IMPORT_CSV_MAX_ZIP_BYTES}
          multiple={false}
          // With a file chosen, its Replace and Remove buttons take the focus.
          noKeyboard={Boolean(file)}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDrop={(files, rejections) => {
            setDragging(false);
            if (rejections.length > 0) {
              showError(t(zipRejectionReason(rejections), { size: maxSize }));
              return;
            }
            const next = files.at(0);
            if (!next) {
              return;
            }
            setError(null);
            onChange(next);
          }}
          onError={() => {
            setDragging(false);
            showError(t("rejected", { size: maxSize }));
          }}
          // Empty, the zone is the control that opens the file picker; with a
          // file, its Replace and Remove buttons are, inside a named group.
          rootProps={importZipRootProps(Boolean(file), Boolean(error), {
            label: labelId,
            title: titleId,
            hint: hintId,
            error: errorId,
          })}
          src={file ? [file] : undefined}
        >
          {file ? (
            <ImportZipChosenFile
              disabled={disabled}
              dragging={dragging}
              file={file}
              onRemove={() => {
                setError(null);
                onChange(null);
              }}
            />
          ) : (
            <ImportZipPrompt
              dragging={dragging}
              hintId={hintId}
              maxSize={maxSize}
              titleId={titleId}
            />
          )}
        </Dropzone>
      </div>
      {/* Always present, so each new error is announced, a repeat included. */}
      <p
        aria-live="assertive"
        className="text-destructive text-xs text-pretty [&:not(:empty)]:mt-1.5"
        id={errorId}
      >
        {error ? (
          <span key={`${localError ? "local" : "server"}-${error.count}`}>
            {error.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}
