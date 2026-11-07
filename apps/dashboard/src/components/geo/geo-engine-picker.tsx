"use client";

import { MoreHorizontalIcon, UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GeoModelCatalogEntry } from "@notra/geo-core/types/geo";
import {
  applyGeoZdrEngineFallback,
  isGeoWebSearchEngine,
  sortKnownEngines,
} from "@notra/geo-core/utils/geo-engines";
import { isGeoOlostepEngine } from "@notra/geo-core/utils/geo-olostep";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { Button } from "@notra/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import { Label } from "@notra/ui/components/ui/label";
import { Switch } from "@notra/ui/components/ui/switch";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { EngineIcon } from "@/components/geo/engine-icon";
import { ZDR_CHECKOUT_SUCCESS_PARAM } from "@/constants/billing";
import { useGeoModelsAdvanced } from "@/lib/hooks/use-geo-models-advanced";
import { cn } from "@/lib/utils";
import type {
  GeoEngineModelMenuProps,
  GeoEnginePickerProps,
  GeoEngineProviderRowProps,
  GeoPendingModelRemoval,
} from "@/types/geo";
import {
  geoPickerProviders,
  isGeoCodingAgentProvider,
  pickGeoProviderEngines,
  recommendedGeoProviders,
} from "@/utils/geo-engine-recommendation";
import { removedLegacyGeoModels } from "@/utils/geo-legacy-models";

export function GeoEnginePicker({
  audience,
  catalog,
  menu,
  selected,
  onChange,
  enforceZdr,
  onEnforceZdrChange,
  nonZdrApproved,
  onNonZdrApprovedChange,
  canEnforceZdr,
  planLoading = false,
  disabled = false,
}: GeoEnginePickerProps) {
  const t = useTranslations("geo.geoEnginePicker");
  const id = useId();
  const { advanced, setAdvanced } = useGeoModelsAdvanced();
  const checkoutReturnHandled = useRef(false);
  const approvedNonZdrIds = new Set(nonZdrApproved);
  const [pendingApproval, setPendingApproval] =
    useState<GeoModelCatalogEntry | null>(null);
  const [pendingDisable, setPendingDisable] =
    useState<GeoPendingModelRemoval | null>(null);

  const lastSelected = selected.length <= 1;
  const zdrActive = enforceZdr && canEnforceZdr;
  const selectedIds = new Set(selected);
  const recommended = recommendedGeoProviders(catalog, audience);
  const pendingModelLabels = removedLegacyGeoModels(
    catalog.models,
    selected,
    pendingDisable?.ids ?? []
  )
    .map((model) => model.label)
    .join(", ");

  // Which rows count as primary is decided from the selection when the pane
  // opens or Advanced flips, not on every toggle: otherwise a provider jumps
  // up the list as it is turned on, or vanishes as it is turned off.
  const [pinned, setPinned] = useState(() => ({
    advanced,
    selected: new Set(selected),
  }));
  if (pinned.advanced !== advanced) {
    setPinned({ advanced, selected: new Set(selected) });
  }
  const providers = geoPickerProviders(catalog, selectedIds);
  const isPrimary = ({ provider, models }: (typeof providers)[number]) =>
    provider.featured ||
    recommended.has(provider.id) ||
    (audience === "technical" && isGeoCodingAgentProvider(provider.id)) ||
    models.some((model) => pinned.selected.has(model.id));
  const primary = providers.filter(isPrimary);
  const more = providers.filter((entry) => !isPrimary(entry));
  const visible = advanced ? [...primary, ...more] : primary;

  const select = (ids: readonly string[]) => {
    const eligible = ids.filter((id) =>
      catalog.models.some(
        (model) => model.id === id && (!model.hidden || selectedIds.has(id))
      )
    );
    onChange(sortKnownEngines(catalog, [...selected, ...eligible]));
  };
  const deselect = (ids: readonly string[]) => {
    const remove = new Set(ids);
    onChange(selected.filter((engine) => !remove.has(engine)));
    onNonZdrApprovedChange(
      nonZdrApproved.filter((engine) => !remove.has(engine))
    );
  };
  const requestDeselect = (ids: readonly string[]) => {
    if (removedLegacyGeoModels(catalog.models, selected, ids).length > 0) {
      setPendingDisable({ ids });
      return;
    }
    deselect(ids);
  };

  const toggleProvider = (
    models: readonly GeoModelCatalogEntry[],
    checked: boolean
  ) => {
    if (!checked) {
      requestDeselect(
        models.filter((model) => selectedIds.has(model.id)).map((m) => m.id)
      );
      return;
    }
    const eligible = zdrActive
      ? models.filter(
          (model) => model.zdr !== "none" || approvedNonZdrIds.has(model.id)
        )
      : models;
    const picks = pickGeoProviderEngines(eligible, audience);
    if (picks.length > 0) {
      select(picks);
      return;
    }
    const [first] = pickGeoProviderEngines(models, audience);
    const firstModel = models.find((model) => model.id === first);
    if (firstModel) {
      setPendingApproval(firstModel);
    }
  };

  const toggleModel = (model: GeoModelCatalogEntry, checked: boolean) => {
    if (!checked) {
      requestDeselect([model.id]);
      return;
    }
    if (model.hidden && !selectedIds.has(model.id)) {
      return;
    }
    const needsApproval =
      zdrActive && model.zdr === "none" && !approvedNonZdrIds.has(model.id);
    if (needsApproval) {
      setPendingApproval(model);
      return;
    }
    select([model.id]);
  };

  const approvePending = () => {
    if (!pendingApproval) {
      return;
    }
    onNonZdrApprovedChange(
      sortKnownEngines(catalog, [...nonZdrApproved, pendingApproval.id])
    );
    select([pendingApproval.id]);
    setPendingApproval(null);
  };

  // Enforcing ZDR turns off models without a ZDR host and, when nothing is
  // left, turns on the default ZDR models. Say which, since it changes what a
  // scan runs and costs.
  const announceZdrModelChanges = useCallback(
    (nextSelected: readonly string[]) => {
      const labelsFor = (ids: readonly string[]) =>
        ids
          .map(
            (engine) =>
              catalog.models.find((model) => model.id === engine)?.label ??
              engine
          )
          .join(", ");
      const before = new Set(selected);
      const after = new Set(nextSelected);
      const removed = selected.filter((engine) => !after.has(engine));
      const added = nextSelected.filter((engine) => !before.has(engine));
      if (removed.length === 0 && added.length === 0) {
        return;
      }
      const description = [
        removed.length > 0
          ? t("zdrModelsRemoved", { models: labelsFor(removed) })
          : null,
        added.length > 0
          ? t("zdrModelsAdded", { models: labelsFor(added) })
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      toast.info(t("zdrModelsChanged"), { description });
    },
    [catalog, selected, t]
  );

  const confirmDisable = () => {
    if (!pendingDisable) {
      return;
    }
    if (pendingDisable.enforceZdr) {
      onEnforceZdrChange(true);
      const nextSelected = applyGeoZdrEngineFallback(catalog, selected, {
        enforceZdr: true,
        nonZdrApprovedEngines: nonZdrApproved,
      });
      onChange(nextSelected);
      announceZdrModelChanges(nextSelected);
      const removedIds = new Set(pendingDisable.ids);
      onNonZdrApprovedChange(
        nonZdrApproved.filter((id) => !removedIds.has(id))
      );
    } else {
      deselect(pendingDisable.ids);
    }
    setPendingDisable(null);
  };

  const handleZdrChange = useCallback(
    (next: boolean) => {
      if (next) {
        const nextSelected = applyGeoZdrEngineFallback(catalog, selected, {
          enforceZdr: true,
          nonZdrApprovedEngines: nonZdrApproved,
        });
        const nextIds = new Set(nextSelected);
        const removedIds = selected.filter((id) => !nextIds.has(id));
        if (
          removedLegacyGeoModels(catalog.models, selected, removedIds).length >
          0
        ) {
          setPendingDisable({ ids: removedIds, enforceZdr: true });
          return;
        }
        onChange(nextSelected);
        announceZdrModelChanges(nextSelected);
      }
      onEnforceZdrChange(next);
    },
    [
      announceZdrModelChanges,
      catalog,
      nonZdrApproved,
      onChange,
      onEnforceZdrChange,
      selected,
    ]
  );

  useEffect(() => {
    if (checkoutReturnHandled.current || !canEnforceZdr) {
      return;
    }

    const returnUrl = new URL(window.location.href);
    if (returnUrl.searchParams.get(ZDR_CHECKOUT_SUCCESS_PARAM) !== "true") {
      return;
    }

    checkoutReturnHandled.current = true;
    handleZdrChange(true);
    returnUrl.searchParams.delete(ZDR_CHECKOUT_SUCCESS_PARAM);
    window.history.replaceState(null, "", returnUrl);
  }, [canEnforceZdr, handleZdrChange]);

  const providerProps = {
    catalog,
    disabled,
    lastSelected,
    onToggleModel: toggleModel,
    onToggleProvider: toggleProvider,
    selectedCount: selected.length,
    selectedIds,
    approvedNonZdrIds,
    zdrActive,
  };

  return (
    <>
      <TitleCard
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={t("options")}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={MoreHorizontalIcon}
                size={16}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-52">
              {menu}
              {menu ? <DropdownMenuSeparator /> : null}
              <DropdownMenuCheckboxItem
                checked={advanced}
                closeOnClick={false}
                disabled={disabled}
                indicator="switch"
                onCheckedChange={setAdvanced}
              >
                {t("advanced")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        as="section"
        contentClassName="px-2 py-2"
        heading={t("title")}
        headingAs="h2"
      >
        <ul className="flex flex-col gap-0.5">
          {visible.map((entry) => (
            <GeoEngineProviderRow
              advanced={advanced}
              id={id}
              key={entry.provider.id}
              {...entry}
              {...providerProps}
            />
          ))}
        </ul>
        {canEnforceZdr ? (
          <>
            <div className="bg-border/60 mx-3 my-1.5 h-px" />
            <div className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5">
              <div className="space-y-0.5">
                <Label htmlFor={`${id}-zdr`}>{t("enforceZdr")}</Label>
                <p className="text-muted-foreground text-xs text-pretty">
                  {t("zdrEnabledHint")}
                </p>
              </div>
              <Switch
                checked={enforceZdr}
                disabled={disabled || planLoading}
                id={`${id}-zdr`}
                onCheckedChange={handleZdrChange}
              />
            </div>
          </>
        ) : null}
      </TitleCard>

      <ConfirmDialog
        confirmLabel={t("enableWithoutZdr")}
        description={
          pendingApproval && isGeoOlostepEngine(pendingApproval.id)
            ? t("noZdrDescriptionConsumerApp", { model: pendingApproval.label })
            : t("noZdrDescription")
        }
        onConfirm={approvePending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingApproval(null);
          }
        }}
        open={pendingApproval !== null}
        title={t("noZdrTitle", { model: pendingApproval?.label ?? "" })}
      />

      <ConfirmDialog
        confirmLabel={t("turnOff")}
        description={t("turnOffDescription", {
          model: pendingModelLabels,
        })}
        onConfirm={confirmDisable}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDisable(null);
          }
        }}
        open={pendingDisable !== null}
        title={t("turnOffTitle", { model: pendingModelLabels })}
      />
    </>
  );
}

function GeoEngineProviderRow({
  advanced,
  id,
  models,
  provider,
  ...props
}: GeoEngineProviderRowProps) {
  const t = useTranslations("geo.geoEnginePicker");
  const selectedModels = models.filter((model) =>
    props.selectedIds.has(model.id)
  );
  const enabled = selectedModels.length > 0;
  const locked = enabled && selectedModels.length === props.selectedCount;
  const controlId = `${id}-${provider.id}`;

  return (
    <li className="hover:bg-muted/60 flex min-w-0 items-center gap-3 rounded-md px-3 py-2 transition-colors">
      <EngineIcon
        className={cn(
          "size-4 shrink-0 overflow-visible transition",
          !enabled && "opacity-40 grayscale"
        )}
        engine={models[0]?.id ?? provider.id}
      />
      <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm">
        <label
          className={cn(
            "shrink-0 cursor-pointer",
            !enabled && "text-muted-foreground"
          )}
          htmlFor={controlId}
        >
          {provider.label}
        </label>
        {enabled && advanced && models.length > 1 ? (
          <GeoEngineModelMenu models={models} provider={provider} {...props} />
        ) : null}
      </span>
      <Switch
        aria-label={t("toggleProvider", { provider: provider.label })}
        checked={enabled}
        disabled={props.disabled || locked}
        id={controlId}
        onCheckedChange={(next) => props.onToggleProvider(models, next)}
        size="sm"
      />
    </li>
  );
}

function GeoEngineModelMenu({
  approvedNonZdrIds,
  catalog,
  disabled,
  lastSelected,
  models,
  onToggleModel,
  provider,
  selectedIds,
  zdrActive,
}: GeoEngineModelMenuProps) {
  const t = useTranslations("geo.geoEnginePicker");
  const [first, ...rest] = models.filter((model) => selectedIds.has(model.id));
  const label =
    rest.length > 0
      ? t("selectedModels", { model: first?.label ?? "", count: rest.length })
      : (first?.label ?? "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            aria-label={t("modelsFor", { provider: provider.label })}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md outline-none focus-visible:ring-2"
            type="button"
          />
        }
      >
        <span className="truncate">{label}</span>
        <HugeiconsIcon className="size-3.5 shrink-0" icon={UnfoldMoreIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-56">
        {models.map((model) => {
          const checked = selectedIds.has(model.id);
          const note = modelNote({
            approved: approvedNonZdrIds.has(model.id),
            model,
            t,
            webSearch: isGeoWebSearchEngine(catalog, model.id),
            zdrActive,
          });
          return (
            <DropdownMenuCheckboxItem
              checked={checked}
              closeOnClick={false}
              disabled={checked && lastSelected}
              indicator="checkbox"
              key={model.id}
              onCheckedChange={(next) => onToggleModel(model, next)}
            >
              {model.label}
              {note ? (
                <span className="text-muted-foreground ms-auto ps-4 text-xs">
                  {note}
                </span>
              ) : null}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function modelNote({
  approved,
  model,
  t,
  webSearch,
  zdrActive,
}: {
  approved: boolean;
  model: GeoModelCatalogEntry;
  t: ReturnType<typeof useTranslations<"geo.geoEnginePicker">>;
  webSearch: boolean;
  zdrActive: boolean;
}) {
  if (model.hidden) {
    return t("legacyModel");
  }
  if (!webSearch) {
    return t("noWebSearch");
  }
  if (zdrActive && model.zdr === "none") {
    return approved ? t("approvedWithoutZdr") : t("noZdrHost");
  }
  return null;
}
