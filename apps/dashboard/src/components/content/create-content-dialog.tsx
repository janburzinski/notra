"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@notra/ui/components/shared/responsive-dialog";
import { Button } from "@notra/ui/components/ui/button";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Switch } from "@notra/ui/components/ui/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type {
  ContentDataPointSettings,
  OnDemandContentType,
} from "@/schemas/content";
import type { LookbackWindow } from "@/schemas/integrations";
import {
  LOOKBACK_WINDOWS,
  SUPPORTED_SCHEDULE_OUTPUT_TYPES,
} from "@/schemas/integrations";
import { formatSnakeCaseLabel } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/query-keys";

interface CreateContentDialogProps {
  organizationId: string;
  organizationSlug: string;
}

interface FormValues {
  contentType: OnDemandContentType;
  lookbackWindow: LookbackWindow;
  dataPoints: ContentDataPointSettings;
}

const DEFAULT_CONTENT_TYPE: OnDemandContentType =
  SUPPORTED_SCHEDULE_OUTPUT_TYPES.find((value) => value !== "linkedin_post") ??
  "changelog";

const DEFAULT_DATA_POINTS: ContentDataPointSettings = {
  includePullRequests: true,
  includeCommits: true,
  includeLinearIssues: false,
};

export function CreateContentDialog({
  organizationId,
  organizationSlug,
}: CreateContentDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"details" | "advanced">("details");
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation<
    { postId: string; title: string },
    Error,
    FormValues
  >({
    mutationFn: async (value) => {
      const response = await fetch(
        `/api/organizations/${organizationId}/content/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create content");
      }

      return payload;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.POSTS.list(organizationId),
      });
      toast.success("Content generated");
      setOpen(false);
      setStep("details");
      form.reset();
      router.push(`/${organizationSlug}/content/${data.postId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      contentType: DEFAULT_CONTENT_TYPE,
      lookbackWindow: "last_7_days" as LookbackWindow,
      dataPoints: DEFAULT_DATA_POINTS,
    },
    onSubmit: ({ value }) => {
      mutation.mutate(value);
    },
  });

  const isPending = mutation.isPending;

  return (
    <ResponsiveDialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setStep("details");
          form.reset();
        }
      }}
      open={open}
    >
      <ResponsiveDialogTrigger
        render={
          <Button disabled={!organizationId} size="sm">
            <Plus className="size-4" />
            Create Content
          </Button>
        }
      />
      <ResponsiveDialogContent className="sm:max-w-[560px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-2xl">
            Create Content
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {step === "details" &&
              "Choose what to generate and the timeframe to analyze."}
            {step === "advanced" &&
              "Optionally disable data points before generation."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground text-xs">
              {step === "details" ? "Step 1 of 2" : "Step 2 of 2"}
            </p>

            {step === "details" ? (
              <>
                <div className="space-y-2">
                  <Label>Content Type</Label>
                  <div className="rounded-md border px-3 py-2 font-medium text-sm">
                    Changelog
                  </div>
                </div>

                <form.Field name="lookbackWindow">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Timeframe</Label>
                      <Select
                        onValueChange={(value) => {
                          if (value) {
                            field.handleChange(value as LookbackWindow);
                          }
                        }}
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full" id={field.name}>
                          <SelectValue placeholder="Select timeframe">
                            <span className="capitalize">
                              {LOOKBACK_WINDOWS.includes(
                                field.state.value as LookbackWindow
                              )
                                ? formatSnakeCaseLabel(
                                    field.state.value as LookbackWindow
                                  )
                                : "Select timeframe"}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {LOOKBACK_WINDOWS.map((window) => (
                            <SelectItem key={window} value={window}>
                              <span className="capitalize">
                                {formatSnakeCaseLabel(window)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
              </>
            ) : (
              <>
                <form.Field name="dataPoints.includePullRequests">
                  {(field) => (
                    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                      <div>
                        <p className="font-medium text-sm">Pull Requests</p>
                        <p className="text-muted-foreground text-xs">
                          Include PR metadata and PR-level summaries.
                        </p>
                      </div>
                      <Switch
                        checked={field.state.value}
                        disabled={isPending}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="dataPoints.includeCommits">
                  {(field) => (
                    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                      <div>
                        <p className="font-medium text-sm">Commits</p>
                        <p className="text-muted-foreground text-xs">
                          Include commit activity and commit-level change data.
                        </p>
                      </div>
                      <Switch
                        checked={field.state.value}
                        disabled={isPending}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked)
                        }
                      />
                    </div>
                  )}
                </form.Field>
              </>
            )}
          </div>

          <ResponsiveDialogFooter>
            {step === "details" ? (
              <>
                <ResponsiveDialogClose
                  disabled={isPending}
                  render={<Button variant="outline" />}
                >
                  Cancel
                </ResponsiveDialogClose>
                <Button
                  disabled={isPending}
                  onClick={() => setStep("advanced")}
                  type="button"
                  variant="outline"
                >
                  Advanced
                </Button>
              </>
            ) : (
              <Button
                disabled={isPending}
                onClick={() => setStep("details")}
                type="button"
                variant="outline"
              >
                Back
              </Button>
            )}
            <form.Subscribe selector={(state) => [state.canSubmit]}>
              {([canSubmit]) => (
                <Button
                  disabled={!canSubmit || isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    form.handleSubmit();
                  }}
                  type="button"
                >
                  {isPending ? "Creating..." : "Create content"}
                </Button>
              )}
            </form.Subscribe>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
