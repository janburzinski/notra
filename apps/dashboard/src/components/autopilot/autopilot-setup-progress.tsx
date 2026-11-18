"use client";

import {
  Alert02Icon,
  Cancel01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Spinner } from "@notra/ui/components/ui/spinner";
import { cn } from "@notra/ui/lib/utils";

import { Button } from "@/components/button";
import { AUTOPILOT_ONBOARDING_SETUP_DETAILS_SHOWN } from "@/constants/autopilot-onboarding";
import type {
  AutopilotSetupProgressProps,
  AutopilotSetupTask,
} from "@/types/autopilot-onboarding";

const settled = (task: AutopilotSetupTask) =>
  task.status === "done" || task.status === "warning";

const ICONS = {
  done: Tick02Icon,
  warning: Alert02Icon,
  error: Cancel01Icon,
} as const;

/** A spinner while the step runs, a small icon once it's through. */
function StepIcon({ task }: { task: AutopilotSetupTask }) {
  if (task.status === "running") {
    return <Spinner className="size-4" />;
  }
  if (task.status === "pending") {
    return <span className="bg-border size-1.5 rounded-full" />;
  }
  return (
    <HugeiconsIcon
      className={cn(
        "animate-in fade-in-0 duration-normal ease-out motion-reduce:animate-none",
        task.status === "done" && "text-muted-foreground",
        task.status === "warning" && "text-warning",
        task.status === "error" && "text-destructive"
      )}
      icon={ICONS[task.status]}
      size={16}
      strokeWidth={2}
    />
  );
}

function StepRow({ task }: { task: AutopilotSetupTask }) {
  const shown = task.details.slice(0, AUTOPILOT_ONBOARDING_SETUP_DETAILS_SHOWN);
  const more = task.details.length - shown.length;
  return (
    <li className="flex min-w-0 items-start gap-3 py-1.5">
      <span
        aria-hidden="true"
        className="flex h-5 w-4 shrink-0 items-center justify-center"
      >
        <StepIcon task={task} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "duration-normal block text-sm text-pretty transition-colors ease-out",
            task.status === "pending" && "text-muted-foreground"
          )}
        >
          {task.label}
        </span>
        {shown.map((detail) => (
          <span
            className="text-muted-foreground mt-0.5 block text-xs text-pretty"
            key={detail}
          >
            {detail}
          </span>
        ))}
        {more > 0 ? (
          <span className="text-muted-foreground mt-0.5 block text-xs">
            {`and ${more} more`}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** The setup where the questions were: a plain list of what Ollie is doing. */
export function AutopilotSetupProgress({
  tasks,
  onRetry,
  finished,
}: AutopilotSetupProgressProps) {
  const failed = tasks.some((task) => task.status === "error");
  let title = "Setting up Autopilot";
  if (failed) {
    title = "Setup didn't finish";
  } else if (finished) {
    title = "Autopilot is on";
  }

  return (
    <section
      aria-live="polite"
      className="bg-background border-border/70 duration-normal flex w-full flex-col rounded-3xl border px-4 py-3.5 opacity-100 transition-opacity ease-out motion-reduce:transition-none starting:opacity-0"
    >
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-2">
        {tasks.map((task) => (
          <StepRow key={task.id} task={task} />
        ))}
      </ul>
      {onRetry ? (
        <footer className="mt-2 flex justify-end">
          <Button onClick={onRetry} size="sm">
            Try again
          </Button>
        </footer>
      ) : null}
    </section>
  );
}
