"use client";

import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { toast } from "sonner";
import { dashboardOrpc } from "@/lib/orpc/query";

type RetentionValue = "never" | "7" | "30" | "90";

const OPTIONS: { value: RetentionValue; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "7", label: "After 7 days" },
  { value: "30", label: "After 30 days" },
  { value: "90", label: "After 90 days" },
];

function toValue(days: number | null): RetentionValue {
  if (days == null) {
    return "never";
  }
  if (days === 7 || days === 30 || days === 90) {
    return String(days) as RetentionValue;
  }
  return "never";
}

function toDays(value: RetentionValue): 7 | 30 | 90 | null {
  if (value === "never") {
    return null;
  }
  return Number(value) as 7 | 30 | 90;
}

export function RetentionSection() {
  const id = useId();
  const queryClient = useQueryClient();

  const { data } = useQuery(
    dashboardOrpc.attachments.getRetention.queryOptions()
  );

  const currentValue: RetentionValue = toValue(data?.retentionDays ?? null);

  const mutation = useMutation({
    mutationFn: async (value: RetentionValue) => {
      await dashboardOrpc.attachments.setRetention.call({
        days: toDays(value),
      });
    },
    onSuccess: async () => {
      toast.success("Auto-delete preference saved");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.attachments.getRetention.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.attachments.list.key(),
        }),
      ]);
    },
    onError: () => {
      toast.error("Failed to update auto-delete preference");
    },
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0 space-y-1">
        <Label className="font-medium text-sm" htmlFor={id}>
          Auto-delete
        </Label>
        <p className="text-muted-foreground text-xs">
          Expired attachments are removed the next time you open this page.
        </p>
      </div>
      <Select
        disabled={mutation.isPending}
        onValueChange={(value) => mutation.mutate(value as RetentionValue)}
        value={currentValue}
      >
        <SelectTrigger className="w-44" id={id}>
          <SelectValue>
            {(value) =>
              OPTIONS.find((option) => option.value === value)?.label ?? "Never"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
