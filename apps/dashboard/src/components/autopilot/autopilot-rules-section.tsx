"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "@notra/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/button";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotRulesSectionProps } from "@/types/autopilot";
import { toErrorMessage } from "@/utils/error-message";

/** What the team told Autopilot to skip; every decision reads these. */
export function AutopilotRulesSection({
  organizationId,
  rules,
}: AutopilotRulesSectionProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: dashboardOrpc.autopilot.key() });
  const add = useMutation({
    mutationFn: () =>
      dashboardOrpc.autopilot.addRule.call({ organizationId, text }),
    onSuccess: async () => {
      setText("");
      await invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the rule")),
  });
  const remove = useMutation({
    mutationFn: (ruleId: string) =>
      dashboardOrpc.autopilot.deleteRule.call({ organizationId, ruleId }),
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not remove the rule")),
  });

  return (
    <section className="flex flex-col gap-3">
      <h3 className="px-1 text-sm font-medium">What Autopilot skips</h3>
      {rules.length > 0 ? (
        <div className="border-shell-border bg-shell rounded-2xl border p-0.5">
          <ul className="divide-table-row-border shadow-table-card bg-table-card border-table-card-border divide-y overflow-hidden rounded-[14px] border">
            {rules.map((rule) => (
              <li className="flex items-start gap-3 px-4 py-2.5" key={rule.id}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm text-pretty">{rule.text}</span>
                  <span className="text-muted-foreground text-xs">
                    {rule.source === "github"
                      ? "From GitHub"
                      : "From the dashboard"}
                    {rule.createdBy ? ` · ${rule.createdBy}` : ""}
                  </span>
                </span>
                <Button
                  aria-label={`Remove rule: ${rule.text}`}
                  className="text-muted-foreground"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(rule.id)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim().length >= 3) {
            add.mutate();
          }
        }}
      >
        <Input
          aria-label="New rule"
          maxLength={300}
          onChange={(event) => setText(event.target.value)}
          placeholder="Never suggest posts about dependency updates"
          value={text}
        />
        <Button
          disabled={text.trim().length < 3}
          loading={add.isPending}
          type="submit"
          variant="outline"
        >
          Add
        </Button>
      </form>
    </section>
  );
}
