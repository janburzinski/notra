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
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@notra/ui/components/ui/combobox";
import { Label } from "@notra/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Switch } from "@notra/ui/components/ui/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import type { GitHubIntegration } from "@/types/integrations";
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

interface SubmitValues extends FormValues {
  repositoryIds: string[];
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
  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<string[]>(
    []
  );
  const [hasInitializedRepoSelection, setHasInitializedRepoSelection] =
    useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const comboboxAnchor = useComboboxAnchor();

  const { data: integrationsResponse, isLoading: isLoadingRepos } = useQuery<{
    integrations: Array<GitHubIntegration & { type: string }>;
  }>({
    queryKey: QUERY_KEYS.INTEGRATIONS.all(organizationId),
    queryFn: async () => {
      const response = await fetch(
        `/api/organizations/${organizationId}/integrations`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }

      return response.json();
    },
    enabled: !!organizationId,
  });

  const repositories = useMemo(
    () =>
      integrationsResponse?.integrations
        .filter((integration) => integration.type === "github")
        .flatMap((integration) => integration.repositories) ?? [],
    [integrationsResponse]
  );

  const repositoryOptions = useMemo(
    () =>
      repositories.map((repo) => ({
        value: repo.id,
        label: `${repo.owner}/${repo.repo}`,
      })),
    [repositories]
  );

  useEffect(() => {
    if (!open || hasInitializedRepoSelection || repositories.length === 0) {
      return;
    }

    setSelectedRepositoryIds(repositories.map((repository) => repository.id));
    setHasInitializedRepoSelection(true);
  }, [open, hasInitializedRepoSelection, repositories]);

  const mutation = useMutation<
    { postId: string; title: string },
    Error,
    SubmitValues
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
      setSelectedRepositoryIds([]);
      setHasInitializedRepoSelection(false);
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
      mutation.mutate({
        ...value,
        repositoryIds: selectedRepositoryIds,
      });
    },
  });

  const isPending = mutation.isPending;

  return (
    <ResponsiveDialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setHasInitializedRepoSelection(false);
        } else {
          setStep("details");
          setSelectedRepositoryIds([]);
          setHasInitializedRepoSelection(false);
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

                <div className="space-y-2">
                  <Label>Repositories</Label>
                  {isLoadingRepos && <Skeleton className="h-10 w-full" />}
                  {!isLoadingRepos && repositories.length === 0 && (
                    <div className="rounded-md border border-dashed p-3 text-muted-foreground text-xs">
                      Add a GitHub repository first to scope content.
                    </div>
                  )}
                  {!isLoadingRepos && repositories.length > 0 && (
                    <div ref={comboboxAnchor}>
                      <Combobox
                        items={repositoryOptions.map((repo) => repo.value)}
                        multiple
                        onValueChange={(value) =>
                          setSelectedRepositoryIds(
                            Array.isArray(value) ? value : []
                          )
                        }
                        value={selectedRepositoryIds}
                      >
                        <ComboboxChips>
                          {selectedRepositoryIds.map((repoId) => {
                            const repo = repositoryOptions.find(
                              (option) => option.value === repoId
                            );
                            if (!repo) {
                              return null;
                            }
                            return (
                              <ComboboxChip key={repo.value}>
                                {repo.label}
                              </ComboboxChip>
                            );
                          })}
                          <ComboboxChipsInput placeholder="All repositories" />
                        </ComboboxChips>
                        <ComboboxContent anchor={comboboxAnchor.current}>
                          <ComboboxEmpty>No repositories found.</ComboboxEmpty>
                          <ComboboxList>
                            {repositoryOptions.map((repo) => (
                              <ComboboxItem key={repo.value} value={repo.value}>
                                {repo.label}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Optional. Leave empty to use all connected repositories.
                  </p>
                </div>
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
