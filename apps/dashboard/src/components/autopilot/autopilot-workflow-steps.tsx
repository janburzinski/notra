"use client";

import {
  ArrowDown01Icon,
  FlowConnectionIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import { type ComponentProps, useId, useState } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import {
  AUTOPILOT_WORKFLOW_STEP_ICONS,
  AUTOPILOT_WORKFLOW_STEP_STATUS,
} from "@/constants/autopilot-ui";
import { AUTOPILOT_WORKFLOW_MIN_SHOWN_STEP_MS } from "@/constants/autopilot-workflows";
import { cn } from "@/lib/utils";
import type {
  AutopilotWorkflowStep,
  AutopilotWorkflowStepDetailsProps,
  AutopilotWorkflowStepProps,
  AutopilotWorkflowStepsProps,
  AutopilotWorkflowStepToggleProps,
} from "@/types/autopilot-workflows";
import { formatDuration } from "@/utils/autopilot-events";
import {
  describeAutopilotWorkflowOutput,
  orderAutopilotWorkflowSteps,
  readableAutopilotWorkflowSettings,
} from "@/utils/autopilot-workflows";

function durationOf(startedAt: Date | null, finishedAt: Date | null) {
  if (!(startedAt && finishedAt)) {
    return null;
  }
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  // Instant steps would only add noise next to the check mark.
  return ms >= AUTOPILOT_WORKFLOW_MIN_SHOWN_STEP_MS ? formatDuration(ms) : null;
}

function StepToggle({
  label,
  stepTitle,
  controls,
  open,
  onClick,
}: AutopilotWorkflowStepToggleProps) {
  return (
    <button
      aria-controls={open ? controls : undefined}
      aria-expanded={open}
      aria-label={`${label}: ${stepTitle}`}
      className={cn(
        "hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium transition-colors",
        open ? "text-foreground" : "text-muted-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
      <HugeiconsIcon
        aria-hidden="true"
        className={cn(
          "duration-fast size-3.5 transition-transform ease-out",
          open && "rotate-180"
        )}
        icon={ArrowDown01Icon}
      />
    </button>
  );
}

/**
 * A result is written by an agent that read the web, so an image in it could
 * carry earlier step data to whoever hosts it. It shows as its alt text, and
 * nothing loads; links stay, for citations.
 */
function ImageAsText({ alt }: ComponentProps<"img">) {
  return alt ? <span className="text-muted-foreground">[{alt}]</span> : null;
}

const STEP_RESULT_COMPONENTS = { img: ImageAsText };

function StepStatus({ node }: Pick<AutopilotWorkflowStep, "node">) {
  const status = node.status
    ? AUTOPILOT_WORKFLOW_STEP_STATUS[node.status]
    : null;
  if (!status) {
    return null;
  }
  const done = node.status === "success";
  return (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
      {done ? durationOf(node.startedAt, node.finishedAt) : status.label}
      {done ? <span className="sr-only">{status.label}</span> : null}
      <HugeiconsIcon
        aria-hidden="true"
        className={cn("size-4", status.className)}
        icon={status.icon}
        strokeWidth={1.75}
      />
    </span>
  );
}

/** A step's result and settings, each behind its own toggle. */
function StepDetails({
  title,
  output,
  settings,
}: AutopilotWorkflowStepDetailsProps) {
  const [open, setOpen] = useState<"result" | "settings" | null>(null);
  const panelId = useId();
  const toggle = (panel: "result" | "settings") =>
    setOpen((current) => (current === panel ? null : panel));
  if (!output && settings.length === 0) {
    return null;
  }
  return (
    <>
      <div className="flex items-center gap-3">
        {output ? (
          <StepToggle
            controls={`${panelId}-result`}
            label="Result"
            onClick={() => toggle("result")}
            open={open === "result"}
            stepTitle={title}
          />
        ) : null}
        {settings.length > 0 ? (
          <StepToggle
            controls={`${panelId}-settings`}
            label="Settings"
            onClick={() => toggle("settings")}
            open={open === "settings"}
            stepTitle={title}
          />
        ) : null}
      </div>
      {open === "result" && output ? (
        <div
          className="bg-muted/50 mt-1 max-h-96 overflow-y-auto rounded-xl px-4 py-3"
          id={`${panelId}-result`}
        >
          <MessageResponse
            components={STEP_RESULT_COMPONENTS}
            className="h-auto max-w-3xl text-sm leading-6 [&_h1]:text-base [&_h2]:text-sm [&_ol]:my-2 [&_p]:my-2 [&_ul]:my-2"
            mode="static"
          >
            {output}
          </MessageResponse>
        </div>
      ) : null}
      {open === "settings" ? (
        <dl
          className="bg-muted/50 mt-1 grid gap-3 rounded-xl px-4 py-3"
          id={`${panelId}-settings`}
        >
          {settings.map((setting) => (
            <div className="min-w-0 space-y-0.5" key={setting.label}>
              <dt className="text-muted-foreground text-xs">{setting.label}</dt>
              <dd className="text-sm text-pretty break-words whitespace-pre-wrap">
                {setting.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}

function stepIcon(type: string) {
  return Object.hasOwn(AUTOPILOT_WORKFLOW_STEP_ICONS, type)
    ? AUTOPILOT_WORKFLOW_STEP_ICONS[
        type as keyof typeof AUTOPILOT_WORKFLOW_STEP_ICONS
      ]
    : FlowConnectionIcon;
}

function WorkflowStep({ step, last, showStatus }: AutopilotWorkflowStepProps) {
  const { node, condition } = step;
  const output = showStatus
    ? describeAutopilotWorkflowOutput(node.output)
    : null;
  const note = node.error ?? (node.status === "halted" ? node.reason : null);

  return (
    <li
      className={cn(
        "relative flex gap-3 px-4 py-3",
        node.status === "skipped" && showStatus && "opacity-60"
      )}
    >
      {last ? null : (
        <span
          aria-hidden="true"
          className="bg-border absolute top-12 bottom-0 left-8 w-px"
        />
      )}
      <span className="bg-muted relative flex size-8 shrink-0 items-center justify-center rounded-lg">
        <HugeiconsIcon
          className="size-4"
          icon={stepIcon(node.type)}
          strokeWidth={1.75}
        />
      </span>
      <div className="min-w-0 flex-1 space-y-1 pt-1">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-pretty">{node.title}</p>
            {condition ? (
              <p className="text-muted-foreground text-xs">{condition}</p>
            ) : null}
          </div>
          {showStatus ? <StepStatus node={node} /> : null}
        </div>
        {node.description ? (
          <p className="text-muted-foreground text-sm text-pretty">
            {node.description}
          </p>
        ) : null}
        {note && showStatus ? (
          <p
            className={cn(
              "text-sm text-pretty",
              node.status === "error" ? "text-destructive" : "text-warning"
            )}
          >
            {note}
          </p>
        ) : null}
        <StepDetails
          output={output}
          settings={node.settings ?? []}
          title={node.title}
        />
      </div>
    </li>
  );
}

/** The workflow as a readable list of steps, with a run's results when given. */
export function AutopilotWorkflowSteps({
  view,
  settingsView,
  showStatus,
}: AutopilotWorkflowStepsProps) {
  const titles = new Map(view.nodes.map((node) => [node.id, node.title]));
  const settingsById = new Map(
    settingsView.nodes.map((node) => [node.id, node.settings ?? []])
  );
  const steps = orderAutopilotWorkflowSteps(view).map((step) => ({
    ...step,
    node: {
      ...step.node,
      settings: readableAutopilotWorkflowSettings(
        step.node.settings ?? settingsById.get(step.node.id) ?? [],
        titles
      ),
    },
  }));
  return (
    <div className={TABLE_FRAME_CLASS}>
      <ol className={cn(TABLE_BODY_CLASS, "py-1")}>
        {steps.map((step, index) => (
          <WorkflowStep
            key={step.node.id}
            last={index === steps.length - 1}
            showStatus={showStatus}
            step={step}
          />
        ))}
      </ol>
    </div>
  );
}
