"use client";

import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageZoom } from "@notra/ui/components/kibo-ui/image-zoom";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Image from "@/components/framework/image";

import type { ToolOutputImage } from "./types";
import { downloadToolOutputImage } from "./utils";

export function ToolOutputImages({ images }: { images: ToolOutputImage[] }) {
  const t = useTranslations("ai.toolBlock");
  const tCommon = useTranslations("common");
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {images.map((image, index) => (
        <div
          className="group/image border-border bg-muted/20 relative w-fit max-w-full overflow-hidden rounded-lg border"
          key={`${image.url}-${index}`}
        >
          <ImageZoom
            className="block max-w-full transition-opacity group-hover/image:opacity-90"
            zoomMargin={24}
          >
            <Image
              alt={image.filename ?? t("outputImageAlt")}
              className="block h-auto max-h-64 w-auto max-w-full cursor-pointer"
              height={512}
              src={image.url}
              unoptimized
              width={768}
            />
          </ImageZoom>
          <Button
            aria-label={tCommon("labels.downloadImage")}
            className="bg-background/90 dark:bg-background/90 absolute top-2 right-2 opacity-0 shadow-sm backdrop-blur group-hover/image:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              downloadToolOutputImage(image);
            }}
            size="icon"
            title={tCommon("labels.downloadImage")}
            variant="outline"
          >
            <HugeiconsIcon
              icon={Download01Icon}
              aria-hidden="true"
              className="size-4"
            />
          </Button>
        </div>
      ))}
    </div>
  );
}
