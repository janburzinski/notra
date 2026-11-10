"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TRAFFIC_EMBED_CHARTS } from "@notra/schemas/constants/dashboard/traffic-embed";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { AgentPromptButton } from "@notra/ui/components/ui/agent-prompt-button";
import { Checkbox } from "@notra/ui/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@notra/ui/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { tween } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import { AutopilotTagInput } from "@/components/autopilot/autopilot-tag-input";
import { Button } from "@/components/button";
import { CodeSnippet } from "@/components/geo/code-snippet";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import {
  TRAFFIC_EMBED_DEFAULT_HEIGHT,
  TRAFFIC_EMBED_DEFAULT_RANGE,
  TRAFFIC_EMBED_PREVIEW_FRAME_CLASS,
  TRAFFIC_EMBED_PREVIEW_REVEAL_FALLBACK_MS,
  TRAFFIC_EMBED_PREVIEW_SCALE,
  TRAFFIC_EMBED_RANGES,
  TRAFFIC_EMBED_RESIZE_MESSAGE,
  TRAFFIC_EMBED_SANDBOX,
} from "@/constants/traffic-embed";
import { useAnimatedSize } from "@/lib/hooks/use-animated-size";
import { useGeoTrafficHostQuery } from "@/lib/hooks/use-geo-traffic-host";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useWebAnalyticsFlag } from "@/lib/hooks/use-web-analytics-flag";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  TrafficEmbedChart,
  TrafficEmbedPart,
  TrafficEmbedRange,
  TrafficEmbedSource,
  TrafficEmbedSummary,
  TrafficEmbedTheme,
} from "@/types/traffic-embed";
import { toastCopyError } from "@/utils/copy-to-clipboard";
import { toErrorMessage } from "@/utils/error-message";
import {
  normalizeTrafficEmbedOrigin,
  trafficEmbedSnippet,
  trafficEmbedUrl,
} from "@/utils/traffic-embed";
import { trafficEmbedName } from "@/utils/traffic-embed-name";
import { trafficEmbedAgentPrompt } from "@/utils/traffic-embed-prompt";

type EmbedLayout = "full" | "chart" | "metrics";

const LAYOUT_PARTS: Record<EmbedLayout, TrafficEmbedPart[]> = {
  full: ["metrics", "chart"],
  chart: ["chart"],
  metrics: ["metrics"],
};

// Origins are https unless typed otherwise, so the chips leave that out.
function originLabel(origin: string): string {
  return origin.replace(/^https:\/\//, "");
}

function parseOrigin(value: string): string | null {
  const result = normalizeTrafficEmbedOrigin(value);
  return result.ok ? result.origin : null;
}

function parseOriginLabel(value: string): string | null {
  const origin = parseOrigin(value);
  return origin ? originLabel(origin) : null;
}

function OriginsField({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("domainsLabel")}</FieldLabel>
      <AutopilotTagInput
        disabled={disabled}
        id={id}
        label={t("domainsLabel")}
        onChange={(next) =>
          onChange(next.flatMap((label) => parseOrigin(label) ?? []))
        }
        parse={parseOriginLabel}
        placeholder="example.com"
        values={values.map(originLabel)}
      />
      <FieldDescription>{t("domainsHint")}</FieldDescription>
    </Field>
  );
}

/**
 * Collapsed to one line by default: most embeds keep their charts, so the
 * picker only opens when someone wants to change them.
 */
function ChartsField({
  values,
  source,
  onChange,
}: {
  values: readonly TrafficEmbedChart[];
  /** Names the traffic chart: AI traffic or website visitors. */
  source: TrafficEmbedSource;
  onChange: (values: TrafficEmbedChart[]) => void;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const id = useId();
  const selected = new Set(values);
  return (
    <Collapsible className="group/charts">
      <CollapsibleTrigger className="flex w-full min-w-0 items-center text-left">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="flex-1 font-medium" id={id}>
            {t("chartsLabel")}
          </span>
          <HugeiconsIcon
            aria-hidden
            className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[open]/charts:rotate-180"
            icon={ArrowDown01Icon}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          aria-labelledby={id}
          className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
          role="group"
        >
          {TRAFFIC_EMBED_CHARTS.map((chart) => (
            // biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control
            <label
              className="flex cursor-pointer items-center gap-2 text-sm"
              key={chart}
            >
              <Checkbox
                checked={selected.has(chart)}
                onCheckedChange={(next) =>
                  onChange(
                    TRAFFIC_EMBED_CHARTS.filter((value) =>
                      value === chart ? next === true : selected.has(value)
                    )
                  )
                }
              />
              {chart === "traffic"
                ? t(`frameTitles.${source}`)
                : t(`charts.${chart}`)}
            </label>
          ))}
        </div>
        {selected.has("share-of-voice") ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {t("chartsHint")}
          </p>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The preview does what embed.js does on customer pages: fit the content.
 * `ready` turns true once the current `src` has reported its height, so the
 * frame can fade in instead of flashing a blank page. A page that never
 * reports one, such as an error page, still shows shortly after it loads.
 */
function useEmbedPreviewHeight(src: string) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(TRAFFIC_EMBED_DEFAULT_HEIGHT);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const ready = readySrc === src;
  useEffect(() => {
    if (!frame) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; height?: unknown } | null;
      if (
        event.source === frame.contentWindow &&
        event.origin === window.location.origin &&
        data?.type === TRAFFIC_EMBED_RESIZE_MESSAGE &&
        typeof data.height === "number"
      ) {
        setHeight(Math.ceil(data.height));
        setReadySrc(src);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame, src]);
  useEffect(() => {
    if (ready || loadedSrc !== src) {
      return;
    }
    const timer = window.setTimeout(
      () => setReadySrc(src),
      TRAFFIC_EMBED_PREVIEW_REVEAL_FALLBACK_MS
    );
    return () => window.clearTimeout(timer);
  }, [ready, loadedSrc, src]);
  return {
    height,
    ready,
    frameRef: setFrame,
    onLoad: () => setLoadedSrc(src),
  };
}

/** One select in the preview options row; the values name themselves. */
function OptionSelect<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Select
      items={items}
      onValueChange={(next) => onChange(next as T)}
      value={value}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmbedDetails({
  organizationId,
  embed,
}: {
  organizationId: string;
  embed: TrafficEmbedSummary;
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("geo.trafficEmbed");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [origins, setOrigins] = useState(embed.allowedOrigins);
  const [charts, setCharts] = useState(embed.charts);
  // What the server last confirmed, which a failed save restores.
  const [saved, setSaved] = useState({
    origins: embed.allowedOrigins,
    charts: embed.charts,
  });
  // A save that finishes while a newer one is queued leaves the controls
  // alone: the newer save carries the full lists and settles them. Refs,
  // since a queued save runs with the callbacks of the render it came from.
  const savedRef = useRef(saved);
  const latestSave = useRef<object | null>(null);
  const [range, setRange] = useState<TrafficEmbedRange>(
    TRAFFIC_EMBED_DEFAULT_RANGE
  );
  const [theme, setTheme] = useState<TrafficEmbedTheme>("auto");
  const [layout, setLayout] = useState<EmbedLayout>("full");
  const origin = useIsClient() ? window.location.origin : "";
  const urlOptions = { range, theme, parts: LAYOUT_PARTS[layout], locale };
  const src = origin ? trafficEmbedUrl(origin, embed.id, urlOptions) : "";
  // Naming the saved charts gives the preview a new URL after each change,
  // so it never shows a copy the CDN kept from before the save.
  const previewSrc = origin
    ? trafficEmbedUrl(origin, embed.id, { ...urlOptions, charts: saved.charts })
    : "";
  const onlyTraffic = charts.length === 1 && charts[0] === "traffic";
  const frameTitle = onlyTraffic
    ? t(`frameTitles.${embed.source}`)
    : t("frameTitle");
  const snippet = src ? trafficEmbedSnippet(origin, src, frameTitle) : "";
  const prompt = snippet
    ? trafficEmbedAgentPrompt(origin, snippet, origins)
    : "";
  const {
    height: previewHeight,
    ready: previewReady,
    frameRef,
    onLoad: onPreviewLoad,
  } = useEmbedPreviewHeight(previewSrc);

  // Each change to the domains or charts saves right away. The shared scope
  // runs the saves one after another, so an older list can't land after a
  // newer one.
  const save = useMutation({
    scope: { id: `traffic-embed-origins:${embed.id}` },
    mutationFn: (next: {
      allowedOrigins: string[];
      charts: TrafficEmbedChart[];
    }) =>
      dashboardOrpc.trafficEmbeds.update.call({
        organizationId,
        embedId: embed.id,
        name: embed.name,
        ...next,
      }),
    onSuccess: async ({ embed: updated }) => {
      savedRef.current = {
        origins: updated.allowedOrigins,
        charts: updated.charts,
      };
      setSaved(savedRef.current);
      toast.success(t("saved"));
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.trafficEmbeds.list.key(),
      });
    },
    onError: (error, variables) => {
      if (latestSave.current === variables) {
        setOrigins(savedRef.current.origins);
        setCharts(savedRef.current.charts);
      }
      toast.error(toErrorMessage(error, t("saveFailed")));
    },
  });

  const persist = (next: {
    allowedOrigins: string[];
    charts: TrafficEmbedChart[];
  }) => {
    latestSave.current = next;
    save.mutate(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <OriginsField
        onChange={(next) => {
          if (next.length === 0) {
            toast.error(t("domainsRequired"));
            return;
          }
          setOrigins(next);
          persist({ allowedOrigins: next, charts });
        }}
        values={origins}
      />
      <ChartsField
        onChange={(next) => {
          if (next.length === 0) {
            toast.error(t("chartsRequired"));
            return;
          }
          setCharts(next);
          persist({ allowedOrigins: origins, charts: next });
        }}
        source={embed.source}
        values={charts}
      />
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "grid grid-cols-1 gap-2",
            charts.includes("traffic") ? "sm:grid-cols-3" : "sm:grid-cols-2"
          )}
        >
          <OptionSelect
            items={TRAFFIC_EMBED_RANGES.map((value) => ({
              value,
              label: t(`ranges.${value}`),
            }))}
            label={t("rangeLabel")}
            onChange={setRange}
            value={range}
          />
          <OptionSelect
            items={(["auto", "light", "dark"] as const).map((value) => ({
              value,
              label: t(`themes.${value}`),
            }))}
            label={t("themeLabel")}
            onChange={setTheme}
            value={theme}
          />
          {charts.includes("traffic") ? (
            <OptionSelect
              items={(["full", "chart", "metrics"] as const).map((value) => ({
                value,
                label: t(`layouts.${value}`),
              }))}
              label={t("layoutLabel")}
              onChange={setLayout}
              value={layout}
            />
          ) : null}
        </div>
        <div
          className="h-(--embed-preview-height) overflow-hidden"
          style={
            {
              "--embed-preview-height": `${Math.ceil(previewHeight * TRAFFIC_EMBED_PREVIEW_SCALE)}px`,
            } as CSSProperties
          }
        >
          {previewSrc ? (
            <iframe
              className={cn(
                TRAFFIC_EMBED_PREVIEW_FRAME_CLASS,
                "duration-normal transition-opacity ease-out motion-reduce:transition-none",
                previewReady ? "opacity-100" : "opacity-0"
              )}
              height={previewHeight}
              onLoad={onPreviewLoad}
              ref={frameRef}
              sandbox={TRAFFIC_EMBED_SANDBOX}
              src={previewSrc}
              tabIndex={-1}
              title={t("previewTitle")}
            />
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <CodeSnippet
          className="min-w-0 flex-1"
          code={snippet}
          label={t("snippetLabel")}
          variant="command"
        />
        <AgentPromptButton
          copiedLabel={tCommon("labels.promptCopied")}
          disabled={!prompt}
          label={tCommon("labels.copyAgentPrompt")}
          onCopyError={toastCopyError}
          prompt={prompt}
        />
      </div>
    </div>
  );
}

/** The create step; the dialog owns its state because its footer submits. */
function CreateEmbedForm({
  formId,
  source,
  origins,
  showSource,
  pending,
  onSourceChange,
  onOriginsChange,
  onSubmit,
}: {
  formId: string;
  source: TrafficEmbedSource;
  origins: string[];
  showSource: boolean;
  pending: boolean;
  onSourceChange: (source: TrafficEmbedSource) => void;
  onOriginsChange: (origins: string[]) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("geo.trafficEmbed");
  return (
    <form
      className="flex flex-col gap-4"
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {showSource ? (
        <OptionSelect
          items={(["agents", "web"] as const).map((value) => ({
            value,
            label: t(`sources.${value}`),
          }))}
          label={t("sourceLabel")}
          onChange={onSourceChange}
          value={source}
        />
      ) : null}
      <OriginsField
        disabled={pending}
        onChange={onOriginsChange}
        values={origins}
      />
    </form>
  );
}

/** Stands in for the create form while the embed list loads. */
function EmbedDialogSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function TrafficEmbedDialog({
  organizationId,
  open,
  prefetch = false,
  defaultSource,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  /** Loads the list before the dialog opens, so it opens at its final size. */
  prefetch?: boolean;
  /** The Analytics tab the dialog opened from. */
  defaultSource: TrafficEmbedSource;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("geo.trafficEmbed");
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();
  const webFlag = useWebAnalyticsFlag();
  const formId = useId();
  const reduceMotion = useReducedMotion();
  const { ref: bodyRef, size: bodySize } = useAnimatedSize();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftOrigins, setDraftOrigins] = useState<string[]>([]);
  // Null until picked, so it follows the tab the dialog opened from.
  const [draftSource, setDraftSource] = useState<TrafficEmbedSource | null>(
    null
  );
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [host] = useGeoTrafficHostQuery();
  const { data, isPending } = useQuery({
    ...dashboardOrpc.trafficEmbeds.list.queryOptions({
      input: { organizationId, ...(projectId ? { projectId } : {}) },
    }),
    enabled: (open || prefetch) && Boolean(organizationId),
  });
  const embeds = data?.embeds ?? [];
  const selected =
    embeds.find((embed) => embed.id === selectedId) ?? embeds[0] ?? null;
  const showCreate = !isPending && (creating || selected === null);
  const showSource = webFlag.enabled;
  const embedItems = embeds.map((embed) => ({
    value: embed.id,
    label: showSource
      ? t("embedOption", {
          name: embed.name,
          source: t(`sources.${embed.source}`),
        })
      : embed.name,
  }));
  const source = draftSource ?? (showSource ? defaultSource : "agents");

  const resetDraft = () => {
    setDraftOrigins([]);
    setDraftSource(null);
  };

  const create = useMutation({
    mutationFn: (origins: string[]) =>
      dashboardOrpc.trafficEmbeds.create.call({
        organizationId,
        ...(projectId ? { projectId } : {}),
        ...(host ? { host } : {}),
        source,
        name: trafficEmbedName(origins),
        allowedOrigins: origins,
      }),
    onSuccess: async ({ embed }) => {
      toast.success(t("created"));
      setSelectedId(embed.id);
      setCreating(false);
      resetDraft();
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.trafficEmbeds.list.key(),
      });
    },
    onError: (error) => toast.error(toErrorMessage(error, t("createFailed"))),
  });

  const revoke = useMutation({
    mutationFn: (embedId: string) =>
      dashboardOrpc.trafficEmbeds.revoke.call({ organizationId, embedId }),
    onSuccess: async () => {
      setConfirmRevoke(false);
      setSelectedId(null);
      toast.success(t("revoked"));
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.trafficEmbeds.list.key(),
      });
    },
    onError: (error) => toast.error(toErrorMessage(error, t("revokeFailed"))),
  });

  const cancelCreate = () => {
    resetDraft();
    if (embeds.length > 0) {
      setCreating(false);
    } else {
      onOpenChange(false);
    }
  };

  let footer = (
    <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
      {t("done")}
    </Button>
  );
  if (showCreate) {
    footer = (
      <>
        <Button onClick={cancelCreate} type="button" variant="outline">
          {embeds.length > 0 ? t("cancelNew") : t("cancel")}
        </Button>
        <Button
          disabled={draftOrigins.length === 0}
          form={formId}
          loading={create.isPending}
          type="submit"
        >
          {t("create")}
        </Button>
      </>
    );
  } else if (selected) {
    footer = (
      <>
        <Button
          className="sm:mr-auto"
          onClick={() => setConfirmRevoke(true)}
          type="button"
          variant="destructive"
        >
          {t("revoke")}
        </Button>
        {footer}
      </>
    );
  }

  return (
    <ResponsiveDialog
      onOpenChange={(next) => {
        if (!next) {
          setCreating(false);
          resetDraft();
        }
        onOpenChange(next);
      }}
      open={open}
    >
      {/* Anchored to the top, so a taller step grows down instead of moving
          the whole dialog. On short screens only the body scrolls, so the
          header and footer stay in view. */}
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:top-[8svh] sm:max-h-[calc(92svh-1rem)] sm:max-w-2xl sm:translate-y-0">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {/* Steps and the preview change height; the body eases between
            them instead of jumping. */}
        <div className="scrollbar-floating -mx-3 -my-1 flex min-h-0 min-w-0 flex-col overflow-y-auto px-3">
          <LazyMotion features={domAnimation} strict>
            <m.div
              // react-doctor-disable-next-line react-doctor/no-layout-property-animation -- the body eases between two steps' heights, a short bounded change; a transform would squash the form
              animate={{ height: bodySize?.height ?? "auto" }}
              className="-mx-1 shrink-0 overflow-hidden"
              initial={false}
              transition={
                reduceMotion ? { duration: 0 } : tween("normal", "emphasized")
              }
            >
              <div className="flex flex-col gap-4 p-1" ref={bodyRef}>
                {!showCreate && selected ? (
                  <div className="flex items-center gap-2">
                    <Select
                      items={embedItems}
                      onValueChange={(next) => setSelectedId(next as string)}
                      value={selected.id}
                    >
                      <SelectTrigger
                        aria-label={t("embedLabel")}
                        className="min-w-0 flex-1"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {embedItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => setCreating(true)}
                      type="button"
                      variant="outline"
                    >
                      {t("new")}
                    </Button>
                  </div>
                ) : null}
                {isPending ? <EmbedDialogSkeleton /> : null}
                {showCreate ? (
                  <CreateEmbedForm
                    formId={formId}
                    onOriginsChange={setDraftOrigins}
                    onSourceChange={setDraftSource}
                    onSubmit={() => {
                      if (draftOrigins.length > 0 && !create.isPending) {
                        create.mutate(draftOrigins);
                      }
                    }}
                    origins={draftOrigins}
                    pending={create.isPending}
                    showSource={showSource}
                    source={source}
                  />
                ) : null}
                {!showCreate && selected ? (
                  <EmbedDetails
                    embed={selected}
                    key={selected.id}
                    organizationId={organizationId}
                  />
                ) : null}
              </div>
            </m.div>
          </LazyMotion>
        </div>
        <ResponsiveDialogFooter className="shrink-0">
          {footer}
        </ResponsiveDialogFooter>
        <ConfirmDialog
          confirmLabel={t("revoke")}
          description={t("revokeDescription")}
          onConfirm={() => {
            if (selected) {
              revoke.mutate(selected.id);
            }
          }}
          onOpenChange={setConfirmRevoke}
          open={confirmRevoke}
          pending={revoke.isPending}
          title={t("revokeTitle")}
          variant="destructive"
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
