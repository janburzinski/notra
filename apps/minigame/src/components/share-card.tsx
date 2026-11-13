import { useEffect, useRef, useState } from "react";

import { XLogo } from "@/components/x-logo";
import { CARD_HEIGHT, CARD_WIDTH } from "@/constants/share-card";
import type { ShareCardDialogProps } from "@/types/ui";
import { formatScore, shareUrl } from "@/utils/format";
import { cardPath, shareLink, shareText } from "@/utils/share";

/** The player's card with ways to post it, copy its link or save the image. */
export function ShareCardDialog({
  player,
  best,
  onClose,
}: ShareCardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const link = shareLink(player.id, best);
  const image = cardPath(player.id, best.score);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    // closedby="any" closes it on a press outside the card; this does the same where closedby isn't
    // supported yet (Safari). The padding sits inside the card, so only the backdrop hits the dialog.
    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        dialog.close();
      }
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (copy === "idle") {
      return;
    }
    const timer = window.setTimeout(() => setCopy("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copy]);

  let copyLabel = "Copy link";
  if (copy === "copied") {
    copyLabel = "Copied";
  } else if (copy === "failed") {
    copyLabel = "Couldn't copy";
  }

  return (
    <dialog
      aria-labelledby="share-card-title"
      className="px-panel text-ink m-auto w-[min(40rem,calc(100vw-2rem))] p-0 backdrop:bg-black/70"
      closedby="any"
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm" id="share-card-title">
            Share your rank
          </h2>
          <button
            aria-label="Close"
            className="text-ink-3 hover:text-ink font-display px-1 text-sm"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            ✕
          </button>
        </div>
        <img
          alt={`@${player.handle}, #${formatScore(best.rank)} all time`}
          className="pixelated bg-space h-auto w-full"
          height={CARD_HEIGHT}
          src={image}
          width={CARD_WIDTH}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <a
            className="px-button text-2xs py-2"
            data-variant="x"
            href={shareUrl(shareText(best), link)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <XLogo />
            Post on X
          </a>
          <button
            className="px-button text-2xs py-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopy("copied");
              } catch {
                setCopy("failed");
              }
            }}
            type="button"
          >
            <span aria-live="polite">{copyLabel}</span>
          </button>
          <a
            className="px-button text-2xs py-2"
            download={`notra-dogfight-${player.handle}.png`}
            href={image}
          >
            Save image
          </a>
        </div>
      </div>
    </dialog>
  );
}
