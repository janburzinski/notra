import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { Slack } from "@notra/ui/components/ui/svgs/slack";

import { MockFrame } from "@/components/landing/mock-frame";
import { AUTOPILOT_WORKFLOW_CARD } from "@/constants/feature-pages/autopilot";

export function AutopilotCardWorkflow() {
  const { frame, steps } = AUTOPILOT_WORKFLOW_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <ol className="divide-border flex flex-col divide-y">
        {steps.map((step) => (
          <li className="flex items-center gap-3 px-4 py-3" key={step.name}>
            {"brand" in step ? (
              <Slack aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
                icon={step.icon}
                strokeWidth={1.5}
              />
            )}
            <span className="min-w-0 grow truncate text-sm font-medium">
              {step.name}
            </span>
            <Badge shape="rounded" size="md" variant="secondary">
              {step.kind}
            </Badge>
          </li>
        ))}
      </ol>
    </MockFrame>
  );
}
