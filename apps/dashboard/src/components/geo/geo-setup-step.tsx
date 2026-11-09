import { cn } from "@/lib/utils";
import type { GeoSetupStepProps } from "@/types/geo";

export function GeoSetupStep({
  index,
  title,
  description,
  action,
  children,
  plain = false,
}: GeoSetupStepProps) {
  return (
    <li
      className={cn(
        "group/step relative grid gap-x-3 last:pb-0",
        plain
          ? "grid-cols-[0.75rem_minmax(0,1fr)] pb-7"
          : "grid-cols-[1.25rem_minmax(0,1fr)] pb-5"
      )}
    >
      {plain ? (
        <span
          aria-hidden
          className="text-muted-foreground text-sm leading-6 tabular-nums"
        >
          {index}
        </span>
      ) : (
        <>
          <span
            aria-hidden
            className="bg-border absolute top-7 bottom-1.5 left-2.5 w-px -translate-x-1/2 group-last/step:hidden"
          />
          <span
            aria-hidden
            className="bg-muted text-muted-foreground mt-0.5 flex size-5 items-center justify-center rounded-full text-xs font-medium tabular-nums"
          >
            {index}
          </span>
        </>
      )}
      <div className="min-w-0 space-y-2">
        <div
          className={cn(
            "flex flex-wrap justify-between gap-x-3 gap-y-2",
            plain ? "items-center" : "items-start"
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <h4
              className={cn(
                "text-sm",
                plain ? "leading-6 text-pretty" : "font-medium"
              )}
            >
              {title}
            </h4>
            {description ? (
              <p className="text-muted-foreground text-xs text-pretty">
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            // Plain: the tabs stay inside the title's line box.
            <div className={cn("max-w-full", plain && "-my-1")}>{action}</div>
          ) : null}
        </div>
        {children}
      </div>
    </li>
  );
}
