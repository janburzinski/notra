import { useEffect, useRef, useState } from "react";

import { RemoteImage } from "@/components/remote-image";
import { XLogo } from "@/components/x-logo";
import { PRIVACY_URL } from "@/constants/site";
import type { AccountProps, SignInButtonProps } from "@/types/ui";
import { deleteMyScores } from "@/utils/api-client";
import { formatScore } from "@/utils/format";

export function SignInButton({ returnTo = "/", children }: SignInButtonProps) {
  return (
    <a
      className="px-button px-3 py-2 text-xs"
      data-variant="x"
      href={`/auth/x/start?return=${encodeURIComponent(returnTo)}`}
    >
      <XLogo />
      {children ?? "Sign in with X"}
    </a>
  );
}

/** Who's signed in, with sign-out and the option to wipe their scores. */
export function Account({ viewer, onDeleted }: AccountProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const player = viewer.player;

  // closes on Escape (focus goes back to the chip) and on any press outside the menu
  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => {
      setOpen(false);
      setConfirming(false);
      setDeleteError(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  let deleteLabel = "Delete my scores";
  if (deleting) {
    deleteLabel = "Deleting…";
  } else if (confirming) {
    deleteLabel = "Press again to delete";
  }

  if (!player) {
    return (
      <div className="flex flex-col items-center gap-2">
        <SignInButton>Sign in with X to save scores</SignInButton>
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        ref={toggleRef}
        className="px-button gap-2.5 py-2 pr-4 pl-2 text-xs normal-case"
        onClick={() => {
          setOpen((value) => !value);
          setConfirming(false);
        }}
        type="button"
      >
        <RemoteImage
          className="pixelated size-7"
          placeholderClassName="bg-space size-7"
          size={28}
          src={player.avatar}
        />
        <span className="max-w-60 truncate">@{player.handle}</span>
      </button>
      {open && (
        <div className="px-panel absolute bottom-full left-1/2 z-20 mb-3 flex w-64 -translate-x-1/2 flex-col gap-3 p-3">
          {viewer.standing.all ? (
            <p className="text-ink-2 text-sm">
              Best:{" "}
              <span className="text-ink">
                {formatScore(viewer.standing.all.score)}
              </span>{" "}
              (#{formatScore(viewer.standing.all.rank)} all time)
            </p>
          ) : (
            <p className="text-ink-3 text-sm">No saved score yet.</p>
          )}
          {player.id.startsWith("dev-") && (
            <p className="text-2xs text-gold">
              Local dev player. Switch with /auth/dev?handle=name.
            </p>
          )}
          <form action="/auth/logout" method="post">
            <button className="px-button text-2xs w-full py-2" type="submit">
              Sign out
            </button>
          </form>
          <button
            className="px-button text-danger text-2xs w-full py-2"
            disabled={deleting}
            onClick={async () => {
              // first press arms it, the second deletes
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setDeleting(true);
              setDeleteError(null);
              try {
                await deleteMyScores();
                setOpen(false);
                onDeleted();
              } catch {
                // keep the menu open so the player sees it failed and can try again
                setDeleteError("Couldn't delete your scores. Try again.");
              } finally {
                setDeleting(false);
                setConfirming(false);
              }
            }}
            type="button"
          >
            {deleteLabel}
          </button>
          {deleteError && (
            <p className="text-danger text-2xs" role="alert">
              {deleteError}
            </p>
          )}
          <a
            className="text-ink-3 hover:text-ink text-2xs underline underline-offset-2"
            href={PRIVACY_URL}
            rel="noopener"
            target="_blank"
          >
            What we store
          </a>
        </div>
      )}
    </div>
  );
}
