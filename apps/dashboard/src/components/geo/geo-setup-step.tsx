import type { GeoSetupStepProps } from "@/types/geo";

export function GeoSetupStep({
  index,
  title,
  description,
  action,
  children,
}: GeoSetupStepProps) {
  return (
    <li className="group/step relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
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
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 space-y-0.5">
            <h4 className="text-sm font-medium">{title}</h4>
            {description ? (
              <p className="text-muted-foreground text-xs text-pretty">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="max-w-full">{action}</div> : null}
        </div>
        {children}
      </div>
    </li>
  );
}
