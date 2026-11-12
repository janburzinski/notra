import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import type { ReactNode } from "react";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import type { EmptyStateProps } from "@/types/components/empty-state";

/**
 * Dashboard empty state on the `@notra/ui` Empty primitives. A ghost
 * `preview` sits above the copy and fades out before it, never behind it.
 */
function EmptyState({
  title,
  titleIcon,
  illustration,
  description,
  action,
  actionLabel,
  actionVariant = "default",
  onActionClick,
  actionIcon,
  preview,
  className,
  ...props
}: EmptyStateProps) {
  const renderedAction =
    action ??
    (actionLabel ? (
      <Button onClick={onActionClick} size="sm" variant={actionVariant}>
        {actionIcon}
        {actionLabel}
      </Button>
    ) : null);

  let media: ReactNode = null;
  if (illustration) {
    media = <EmptyMedia>{illustration}</EmptyMedia>;
  } else if (titleIcon) {
    media = <EmptyMedia variant="icon">{titleIcon}</EmptyMedia>;
  }

  return (
    <Empty className={cn(preview && "justify-start", className)} {...props}>
      {preview ? (
        <div
          aria-hidden
          className="pointer-events-none -mx-3 -mt-9 max-h-48 shrink-0 self-stretch overflow-hidden mask-[linear-gradient(to_bottom,black_0%,transparent_100%)] opacity-[0.38] select-none md:-mt-13"
        >
          {preview}
        </div>
      ) : null}
      <EmptyHeader>
        {media}
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {renderedAction ? (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {renderedAction}
          </div>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export { EmptyState };
