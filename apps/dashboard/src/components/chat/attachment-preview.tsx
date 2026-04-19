"use client";

import { ArrowRight01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@notra/ui/components/ui/dialog";
import { Loader2Icon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { MIME_DISPLAY_LABELS } from "@/constants/upload";
import {
  isImageMimeType,
  isPdfMimeType,
  isTextMimeType,
} from "@/lib/upload/mime";
import type { ChatAttachment } from "@/types/chat";
import { formatBytes } from "@/utils/format";

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load file");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
      </div>
    );
  }

  return (
    <pre className="h-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {content}
    </pre>
  );
}

interface AttachmentPreviewDialogProps {
  attachment: ChatAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
}: AttachmentPreviewDialogProps) {
  if (!attachment) {
    return null;
  }

  const typeLabel =
    MIME_DISPLAY_LABELS[attachment.mediaType] ?? attachment.mediaType;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[80vh] max-w-3xl flex-col gap-3 p-4 sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm">
              {attachment.filename}
            </DialogTitle>
            <p className="mt-1 text-muted-foreground text-xs">
              {typeLabel} · {formatBytes(attachment.size)}
            </p>
          </div>
          <Button
            className="shrink-0"
            render={
              <a
                download={attachment.filename}
                href={attachment.url}
                rel="noopener noreferrer"
                target="_blank"
              />
            }
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon className="size-3.5" icon={Download04Icon} />
            Open
            <HugeiconsIcon className="size-3" icon={ArrowRight01Icon} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          {isImageMimeType(attachment.mediaType) && (
            <div className="relative flex h-full w-full items-center justify-center bg-muted/20">
              <Image
                alt={attachment.filename}
                className="h-full w-full object-contain"
                height={1200}
                src={attachment.url}
                unoptimized
                width={1200}
              />
            </div>
          )}
          {isPdfMimeType(attachment.mediaType) && (
            <iframe
              className="h-full w-full"
              src={attachment.url}
              title={attachment.filename}
            />
          )}
          {isTextMimeType(attachment.mediaType) && (
            <TextPreview url={attachment.url} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
