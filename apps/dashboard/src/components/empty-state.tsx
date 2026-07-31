import type React from "react";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.ComponentProps<"div"> {
  title: string;
  description?: string;
  variant?: "page" | "section" | "table";
  action?: React.ReactNode;
  actionLabel?: string;
  actionVariant?: React.ComponentProps<typeof Button>["variant"];
  onActionClick?: React.ComponentProps<"button">["onClick"];
  actionIcon?: React.ReactNode;
}

function EmptyState({
  title,
  description,
  variant = "page",
  action,
  actionLabel,
  actionVariant = "default",
  onActionClick,
  actionIcon,
  className,
  ...props
}: EmptyStateProps) {
  const renderedAction =
    action ??
    (actionLabel ? (
      <Button onClick={onActionClick} size="sm" variant={actionVariant}>
        {actionIcon ? <span className="mr-2">{actionIcon}</span> : null}
        {actionLabel}
      </Button>
    ) : null);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed text-center",
        variant === "page" && "p-12",
        variant === "section" && "min-h-35 p-6",
        variant === "table" && "min-h-24 border-0 p-4",
        className
      )}
      {...props}
    >
      <h3
        className={cn(
          "font-semibold",
          variant === "table" ? "text-sm" : "text-lg"
        )}
      >
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-xl text-muted-foreground text-sm">
          {description}
        </p>
      ) : null}
      {renderedAction ? (
        <div className={cn(variant === "table" ? "mt-3" : "mt-4")}>
          {renderedAction}
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
