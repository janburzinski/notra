import type { LoadErrorProps } from "@/types/ui";

/** A board that didn't load, with a way to ask again. */
export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <p className="text-ink-3 text-sm">{message}</p>
      <button
        className="px-button text-3xs px-2 py-1"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
