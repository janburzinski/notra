"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
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
import { ScrollArea } from "@notra/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Switch } from "@notra/ui/components/ui/switch";
import { cn } from "@notra/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ContentDataPointSettings,
  OnDemandContentType,
  SelectedItems,
} from "@/schemas/content";
import type { LookbackWindow } from "@/schemas/integrations";
import {
  LOOKBACK_WINDOWS,
  SUPPORTED_SCHEDULE_OUTPUT_TYPES,
} from "@/schemas/integrations";
import type { GitHubIntegration } from "@/types/integrations";
import { formatSnakeCaseLabel } from "@/utils/format";
import { QUERY_KEYS } from "@/utils/query-keys";

// ─── Types ───────────────────────────────────────────────

interface CreateContentDialogProps {
  organizationId: string;
  organizationSlug: string;
}

interface PullRequestPreview {
  number: number;
  title: string;
  authorLogin: string;
  mergedAt: string | null;
}

interface ReleasePreview {
  tagName: string;
  name: string;
  publishedAt: string;
  authorLogin: string;
  prerelease: boolean;
}

interface RepositoryPreview {
  repositoryId: string;
  owner: string;
  repo: string;
  pullRequests: PullRequestPreview[];
  releases: ReleasePreview[];
}

interface PreviewResponse {
  repositories: Array<{
    repositoryId: string;
    owner: string;
    repo: string;
    commits?: unknown[];
    pullRequests?: PullRequestPreview[];
    releases?: ReleasePreview[];
  }>;
}

type Step = "configure" | "nitpick";
interface ReleaseSelection {
  repositoryId: string;
  tagName: string;
}

// ─── Constants ───────────────────────────────────────────

const DEFAULT_CONTENT_TYPE: OnDemandContentType =
  SUPPORTED_SCHEDULE_OUTPUT_TYPES.find((v) => v !== "linkedin_post") ??
  "changelog";

const DEFAULT_DATA_POINTS: ContentDataPointSettings = {
  includePullRequests: true,
  includeCommits: true,
  includeReleases: true,
  includeLinearIssues: false,
};

function releaseSelectionToKey(selection: ReleaseSelection): string {
  return JSON.stringify([selection.repositoryId, selection.tagName]);
}

function releaseSelectionFromKey(key: string): ReleaseSelection | null {
  try {
    const parsed = JSON.parse(key);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return { repositoryId: parsed[0], tagName: parsed[1] };
    }
  } catch {
    return null;
  }
  return null;
}

// ─── Main Component ──────────────────────────────────────

export function CreateContentDialog({
  organizationId,
  organizationSlug,
}: CreateContentDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("configure");
  const [selectedPrKeys, setSelectedPrKeys] = useState<Set<string>>(new Set());
  const [selectedReleaseKeys, setSelectedReleaseKeys] = useState<Set<string>>(
    new Set()
  );
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const previewParamsRef = useRef<string>("");

  const queryClient = useQueryClient();
  const router = useRouter();
  const comboboxAnchor = useComboboxAnchor();

  const form = useForm({
    defaultValues: {
      contentType: DEFAULT_CONTENT_TYPE,
      lookbackWindow: "last_7_days" as LookbackWindow,
      repositoryIds: [] as string[],
      dataPoints: DEFAULT_DATA_POINTS,
    },
  });

  // ─── Integrations ──────────────────────────────────────

  const { data: integrationsResponse, isLoading: isLoadingRepos } = useQuery<{
    integrations: Array<GitHubIntegration & { type: string }>;
  }>({
    queryKey: QUERY_KEYS.INTEGRATIONS.all(organizationId),
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/integrations`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch integrations");
      }
      return res.json();
    },
    enabled: !!organizationId,
  });

  const { repositories, repositoryOptions } = useMemo(() => {
    const repos =
      integrationsResponse?.integrations
        .filter((i) => i.type === "github")
        .flatMap((i) => i.repositories) ?? [];
    return {
      repositories: repos,
      repositoryOptions: repos.map((r) => ({
        value: r.id,
        label: `${r.owner}/${r.repo}`,
      })),
    };
  }, [integrationsResponse]);

  useEffect(() => {
    if (open && repositories.length > 0) {
      const ids = form.getFieldValue("repositoryIds");
      if (ids.length === 0) {
        form.setFieldValue(
          "repositoryIds",
          repositories.map((r) => r.id)
        );
      }
    }
  }, [open, repositories, form]);

  // ─── Preview ───────────────────────────────────────────

  const repositoryIds = useStore(form.store, (s) => s.values.repositoryIds);
  const lookbackWindow = useStore(form.store, (s) => s.values.lookbackWindow);
  const dataPoints = useStore(form.store, (s) => s.values.dataPoints);

  const {
    data: previewData,
    isFetching: isLoadingPreview,
    isError: isPreviewError,
    refetch: fetchPreview,
  } = useQuery<PreviewResponse, Error, RepositoryPreview[]>({
    queryKey: [
      "content-preview",
      organizationId,
      repositoryIds,
      lookbackWindow,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/organizations/${organizationId}/content/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repositoryIds, lookbackWindow }),
        }
      );
      if (!res.ok) {
        throw new Error("Failed to fetch preview");
      }
      return res.json();
    },
    select: (data) =>
      data.repositories.map((r) => ({
        repositoryId: r.repositoryId,
        owner: r.owner,
        repo: r.repo,
        pullRequests: r.pullRequests ?? [],
        releases: r.releases ?? [],
      })),
    enabled: false,
  });

  useEffect(() => {
    if (previewData && !previewLoaded) {
      const prKeys = new Set<string>();
      const relKeys = new Set<string>();
      for (const repo of previewData) {
        for (const pr of repo.pullRequests) {
          prKeys.add(`${repo.repositoryId}:${pr.number}`);
        }
        for (const rel of repo.releases) {
          relKeys.add(
            releaseSelectionToKey({
              repositoryId: repo.repositoryId,
              tagName: rel.tagName,
            })
          );
        }
      }
      setSelectedPrKeys(prKeys);
      setSelectedReleaseKeys(relKeys);
      setPreviewLoaded(true);
    }
  }, [previewData, previewLoaded]);

  // ─── Mutation ──────────────────────────────────────────

  const mutation = useMutation<
    { postId: string; title: string },
    Error,
    {
      contentType: OnDemandContentType;
      lookbackWindow: LookbackWindow;
      repositoryIds: string[];
      dataPoints: ContentDataPointSettings;
      selectedItems?: SelectedItems;
    }
  >({
    mutationFn: async (value) => {
      const res = await fetch(
        `/api/organizations/${organizationId}/content/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }
      );
      const payload = await res.json();
      if (!res.ok) {
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
      router.push(`/${organizationSlug}/content/${data.postId}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // ─── Handlers ──────────────────────────────────────────

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        form.reset();
        setStep("configure");
        setSelectedPrKeys(new Set());
        setSelectedReleaseKeys(new Set());
        setPreviewLoaded(false);
      }
    },
    [form]
  );

  const handleDirectCreate = useCallback(() => {
    mutation.mutate(form.state.values);
  }, [form, mutation]);

  const handleGoToNitpick = useCallback(() => {
    const paramsKey = JSON.stringify({ repositoryIds, lookbackWindow });
    if (previewLoaded && previewParamsRef.current === paramsKey) {
      // Same params – keep existing selections
      setStep("nitpick");
      return;
    }
    previewParamsRef.current = paramsKey;
    setPreviewLoaded(false);
    fetchPreview();
    setStep("nitpick");
  }, [fetchPreview, previewLoaded, repositoryIds, lookbackWindow]);

  const handleBackToConfigure = () => {
    setStep("configure");
  };

  const handleNitpickSubmit = useCallback(() => {
    const value = form.state.values;
    const selectedItems: SelectedItems = {
      pullRequestNumbers: value.dataPoints.includePullRequests
        ? Array.from(selectedPrKeys).map((key) => {
            const [repositoryId, num] = key.split(":");
            return { repositoryId: repositoryId ?? "", number: Number(num) };
          })
        : [],
      releaseTagNames: value.dataPoints.includeReleases
        ? Array.from(selectedReleaseKeys)
            .map((key) => releaseSelectionFromKey(key))
            .filter(
              (selection): selection is ReleaseSelection => selection !== null
            )
        : [],
    };
    mutation.mutate({ ...value, selectedItems });
  }, [form, mutation, selectedPrKeys, selectedReleaseKeys]);

  // ─── Event counts ──────────────────────────────────────

  const eventCounts = useMemo(() => {
    if (!previewData) {
      return { total: 0, selected: 0 };
    }
    let total = 0;
    let selected = 0;
    for (const repo of previewData) {
      if (dataPoints.includePullRequests) {
        total += repo.pullRequests.length;
        for (const pr of repo.pullRequests) {
          if (selectedPrKeys.has(`${repo.repositoryId}:${pr.number}`)) {
            selected++;
          }
        }
      }
      if (dataPoints.includeReleases) {
        total += repo.releases.length;
        for (const r of repo.releases) {
          if (
            selectedReleaseKeys.has(
              releaseSelectionToKey({
                repositoryId: repo.repositoryId,
                tagName: r.tagName,
              })
            )
          ) {
            selected++;
          }
        }
      }
    }
    return { total, selected };
  }, [previewData, dataPoints, selectedPrKeys, selectedReleaseKeys]);

  const hasSelectableEvents =
    dataPoints.includePullRequests || dataPoints.includeReleases;

  // ─── Render ────────────────────────────────────────────

  return (
    <ResponsiveDialog onOpenChange={handleOpenChange} open={open}>
      <ResponsiveDialogTrigger
        render={
          <Button disabled={!organizationId} size="sm">
            <Plus className="size-4" />
            Create Content
          </Button>
        }
      />
      <ResponsiveDialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <ResponsiveDialogHeader className="shrink-0 space-y-1 border-b p-4">
          <ResponsiveDialogTitle>
            {step === "configure" ? "Create Content" : "Customize"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {step === "configure"
              ? "Configure content type, timeframe, and sources."
              : "Fine-tune data sources and pick specific events."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form
          className="!px-0 flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => e.preventDefault()}
        >
          {/* ── Step 1: Configure ── */}
          {step === "configure" && (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                <form.Field name="contentType">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Content Type</Label>
                      <Select
                        onValueChange={(v) => {
                          if (v) {
                            field.handleChange(v as OnDemandContentType);
                          }
                        }}
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full" id={field.name}>
                          <SelectValue placeholder="Select content type">
                            <span className="capitalize">
                              {formatSnakeCaseLabel(field.state.value)}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_SCHEDULE_OUTPUT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              <span className="capitalize">
                                {formatSnakeCaseLabel(type)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <form.Field name="lookbackWindow">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Timeframe</Label>
                      <Select
                        onValueChange={(v) => {
                          if (v) {
                            field.handleChange(v as LookbackWindow);
                          }
                        }}
                        value={field.state.value}
                      >
                        <SelectTrigger className="w-full" id={field.name}>
                          <SelectValue placeholder="Select timeframe">
                            <span className="capitalize">
                              {formatSnakeCaseLabel(field.state.value)}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {LOOKBACK_WINDOWS.map((w) => (
                            <SelectItem key={w} value={w}>
                              <span className="capitalize">
                                {formatSnakeCaseLabel(w)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground text-xs">
                        How far back to look when gathering activity data.
                      </p>
                    </div>
                  )}
                </form.Field>

                <form.Field name="repositoryIds">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Repositories</Label>
                      {isLoadingRepos && <Skeleton className="h-10 w-full" />}
                      {!isLoadingRepos && repositories.length === 0 && (
                        <div className="rounded-md border border-dashed p-3 text-muted-foreground text-xs">
                          Add a GitHub repository first to scope content.
                        </div>
                      )}
                      {!isLoadingRepos && repositories.length > 0 && (
                        <div ref={comboboxAnchor}>
                          <Combobox
                            items={repositoryOptions.map((r) => r.value)}
                            multiple
                            onValueChange={(v) =>
                              field.handleChange(Array.isArray(v) ? v : [])
                            }
                            value={field.state.value}
                          >
                            <ComboboxChips>
                              {field.state.value.map((id) => {
                                const r = repositoryOptions.find(
                                  (o) => o.value === id
                                );
                                if (!r) {
                                  return null;
                                }
                                return (
                                  <ComboboxChip key={r.value}>
                                    {r.label}
                                  </ComboboxChip>
                                );
                              })}
                              <ComboboxChipsInput placeholder="Search repositories" />
                            </ComboboxChips>
                            <ComboboxContent anchor={comboboxAnchor.current}>
                              <ComboboxEmpty>
                                No repositories found.
                              </ComboboxEmpty>
                              <ComboboxList>
                                {repositoryOptions.map((r) => (
                                  <ComboboxItem key={r.value} value={r.value}>
                                    {r.label}
                                  </ComboboxItem>
                                ))}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        </div>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Pick one or more repositories.
                      </p>
                    </div>
                  )}
                </form.Field>
              </div>
            </ScrollArea>
          )}

          {/* ── Step 2: Nitpick ── */}
          {step === "nitpick" && (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-4">
                {/* Data Sources */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Data Sources</h3>
                  <form.Field name="dataPoints.includePullRequests">
                    {(field) => (
                      <DataPointToggle
                        checked={field.state.value}
                        description="Include PR metadata and summaries."
                        disabled={mutation.isPending}
                        label="Pull Requests"
                        onCheckedChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                  <form.Field name="dataPoints.includeCommits">
                    {(field) => (
                      <DataPointToggle
                        checked={field.state.value}
                        description="Include commit-level change data."
                        disabled={mutation.isPending}
                        label="Commits"
                        onCheckedChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                  <form.Field name="dataPoints.includeReleases">
                    {(field) => (
                      <DataPointToggle
                        checked={field.state.value}
                        description="Include GitHub releases and changelogs."
                        disabled={mutation.isPending}
                        label="Releases"
                        onCheckedChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                  <form.Field name="dataPoints.includeLinearIssues">
                    {(field) => (
                      <DataPointToggle
                        checked={field.state.value}
                        description="Include linked Linear issues."
                        disabled={mutation.isPending}
                        label="Linear Issues"
                        onCheckedChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                </div>

                {/* Events */}
                {(dataPoints.includePullRequests ||
                  dataPoints.includeReleases) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">Events</h3>
                      {!isLoadingPreview && eventCounts.total > 0 && (
                        <span className="text-muted-foreground text-xs">
                          {eventCounts.selected} / {eventCounts.total} selected
                        </span>
                      )}
                    </div>
                    {isLoadingPreview && (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    )}
                    {!isLoadingPreview && isPreviewError && (
                      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center text-sm">
                        Failed to load events. Please try again.
                      </div>
                    )}
                    {!isLoadingPreview &&
                      !isPreviewError &&
                      previewData &&
                      (eventCounts.total === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-xs">
                          No events found for the selected timeframe.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {previewData.map((repo) => (
                            <RepoSection
                              dataPoints={dataPoints}
                              key={repo.repositoryId}
                              onTogglePr={(key) => {
                                setSelectedPrKeys((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(key)) {
                                    next.delete(key);
                                  } else {
                                    next.add(key);
                                  }
                                  return next;
                                });
                              }}
                              onToggleRelease={(tag) => {
                                setSelectedReleaseKeys((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(tag)) {
                                    next.delete(tag);
                                  } else {
                                    next.add(tag);
                                  }
                                  return next;
                                });
                              }}
                              repo={repo}
                              selectedPrKeys={selectedPrKeys}
                              selectedReleaseKeys={selectedReleaseKeys}
                            />
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* ── Footer ── */}
          <div className="shrink-0 rounded-b-xl border-t bg-muted/50 p-4">
            {step === "configure" && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  disabled={mutation.isPending || repositoryIds.length === 0}
                  onClick={handleGoToNitpick}
                  type="button"
                  variant="outline"
                >
                  Customize
                </Button>
                <Button
                  disabled={mutation.isPending || repositoryIds.length === 0}
                  onClick={handleDirectCreate}
                  type="button"
                >
                  {mutation.isPending ? "Creating..." : "Create content"}
                </Button>
              </div>
            )}
            {step === "nitpick" && (
              <div className="flex items-center justify-between">
                <Button
                  disabled={mutation.isPending}
                  onClick={handleBackToConfigure}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  disabled={
                    mutation.isPending ||
                    (hasSelectableEvents &&
                      eventCounts.total > 0 &&
                      eventCounts.selected === 0)
                  }
                  onClick={handleNitpickSubmit}
                  type="button"
                >
                  {mutation.isPending ? "Creating..." : "Create content"}
                </Button>
              </div>
            )}
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Subcomponents ─────────────────────────────────────────

function DataPointToggle({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function RepoSection({
  repo,
  dataPoints,
  selectedPrKeys,
  selectedReleaseKeys,
  onTogglePr,
  onToggleRelease,
}: {
  repo: RepositoryPreview;
  dataPoints: ContentDataPointSettings;
  selectedPrKeys: Set<string>;
  selectedReleaseKeys: Set<string>;
  onTogglePr: (key: string) => void;
  onToggleRelease: (key: string) => void;
}) {
  const showPrs =
    dataPoints.includePullRequests && repo.pullRequests.length > 0;
  const showReleases = dataPoints.includeReleases && repo.releases.length > 0;

  if (!showPrs && !showReleases) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/30 px-3 py-2">
        <span className="font-medium text-sm">
          {repo.owner}/{repo.repo}
        </span>
      </div>
      <div className="divide-y">
        {showReleases &&
          repo.releases.map((release) => {
            const releaseKey = releaseSelectionToKey({
              repositoryId: repo.repositoryId,
              tagName: release.tagName,
            });
            return (
              <EventRow
                key={releaseKey}
                label={release.name || release.tagName}
                meta={`${release.authorLogin} · ${formatDate(release.publishedAt)}${release.prerelease ? " · pre-release" : ""}`}
                onToggle={() => onToggleRelease(releaseKey)}
                selected={selectedReleaseKeys.has(releaseKey)}
                type="Release"
              />
            );
          })}
        {showPrs &&
          repo.pullRequests.map((pr) => {
            const key = `${repo.repositoryId}:${pr.number}`;
            return (
              <EventRow
                key={key}
                label={`#${pr.number} ${pr.title}`}
                meta={`${pr.authorLogin} · ${pr.mergedAt ? formatDate(pr.mergedAt) : ""}`}
                onToggle={() => onTogglePr(key)}
                selected={selectedPrKeys.has(key)}
                type="PR"
              />
            );
          })}
      </div>
    </div>
  );
}

type EventType = "PR" | "Release";

const EVENT_BADGE: Record<EventType, string> = {
  Release:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PR: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function EventRow({
  label,
  meta,
  type,
  selected,
  onToggle,
}: {
  label: string;
  meta: string;
  type: EventType;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50",
        selected && "bg-muted/20"
      )}
      onClick={onToggle}
      type="button"
    >
      <div
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30"
        )}
      >
        {selected && <Check className="size-3" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{label}</p>
        <p className="truncate text-muted-foreground text-xs">{meta}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs",
          EVENT_BADGE[type]
        )}
      >
        {type}
      </span>
    </button>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
