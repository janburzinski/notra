"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import type { ComponentProps } from "react";

import { cn } from "@notra/ui/lib/utils";

function Progress({
  className,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      className={cn("flex flex-wrap gap-3", className)}
      data-slot="progress"
      value={value}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "bg-muted h-1 rounded-full relative flex w-full items-center overflow-x-hidden",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

/**
 * Base UI sizes the indicator with a percentage width; animate a full-width
 * bar's horizontal scale instead so the fill stays on the compositor.
 */
function renderScaledIndicator(props: ComponentProps<"div">) {
  const width = props.style?.width;
  if (typeof width !== "string") {
    return <div {...props} />;
  }
  const fraction = Number.parseFloat(width) / 100;
  return (
    <div {...props} style={{ ...props.style, width: "100%", scale: `${fraction} 1` }} />
  );
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      className={cn(
        "bg-primary h-full origin-left transition-[scale] duration-slow ease-out rtl:origin-right",
        className
      )}
      data-slot="progress-indicator"
      render={renderScaledIndicator}
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "text-muted-foreground ml-auto text-sm tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  );
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
};
