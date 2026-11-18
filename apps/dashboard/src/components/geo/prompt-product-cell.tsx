"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_PRODUCT_NAME_MAX_LENGTH,
  GEO_PRODUCTS_MAX,
} from "@notra/geo-core/constants/geo";
import { StatusBadge } from "@notra/ui/components/status-badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@notra/ui/components/ui/combobox";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { GEO_PRODUCT_DOT_CLASSES } from "@/constants/geo-prompts";
import { cn } from "@/lib/utils";
import type { PromptProductCellProps } from "@/types/components/geo";
import { geoProductBadgeVariant } from "@/utils/geo-prompts";

const NO_PRODUCT = "none";
const CREATE_PREFIX = "create:";

function ProductDot({ position }: { position: number | null }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        position === null
          ? "border-muted-foreground/50 border border-dashed"
          : cn(
              "ring-1 ring-inset",
              GEO_PRODUCT_DOT_CLASSES[geoProductBadgeVariant(position)]
            )
      )}
    />
  );
}

/**
 * The prompt's product as a status badge. Clicking it opens a search over the
 * project's products; a name that matches none can be created on the spot.
 */
export function PromptProductCell({
  row,
  products,
  disabled,
  creatingName,
  onMove,
  onCreateProduct,
}: PromptProductCellProps) {
  const t = useTranslations("geo.promptsTable");
  const [query, setQuery] = useState("");

  // A product being created takes the next color, as it will once saved.
  const position = creatingName ? products.length : row.product?.position;
  const badge = (
    <StatusBadge
      appearance={{
        variant:
          position === undefined ? "outline" : geoProductBadgeVariant(position),
      }}
      label={creatingName ?? row.product?.name ?? t("noProduct")}
    />
  );

  // Auto prompts come from settings and can't belong to a product.
  if (row.source === "auto" || products.length === 0) {
    return badge;
  }

  const name = query.trim();
  const taken = products.some(
    (product) => product.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  );
  const canCreate =
    name.length > 0 && !taken && products.length < GEO_PRODUCTS_MAX;
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = [
    ...products.map((product) => product.id),
    NO_PRODUCT,
    ...(canCreate ? [`${CREATE_PREFIX}${name}`] : []),
  ];
  // The create row's label is the typed name, so filtering always keeps it.
  const label = (item: string) => {
    if (item === NO_PRODUCT) {
      return t("noProduct");
    }
    if (item.startsWith(CREATE_PREFIX)) {
      return item.slice(CREATE_PREFIX.length);
    }
    return byId.get(item)?.name ?? item;
  };
  const current = row.product?.id ?? NO_PRODUCT;

  return (
    <div className="min-w-0" onClick={(event) => event.stopPropagation()}>
      <Combobox
        autoHighlight
        inputValue={query}
        itemToStringLabel={label}
        items={items}
        onInputValueChange={setQuery}
        onValueChange={(next: string | null) => {
          if (!next || next === current) {
            return;
          }
          if (next.startsWith(CREATE_PREFIX)) {
            onCreateProduct(next.slice(CREATE_PREFIX.length));
            return;
          }
          onMove(byId.get(next) ?? null);
        }}
        value={current}
      >
        <ComboboxPrimitive.Trigger
          aria-label={t("changeProductAria", { prompt: row.prompt })}
          disabled={disabled || Boolean(creatingName)}
          render={
            <button
              className={cn(
                "flex max-w-full cursor-pointer rounded-md outline-none disabled:pointer-events-none",
                creatingName ? "animate-pulse" : "disabled:opacity-60"
              )}
              type="button"
            />
          }
        >
          {badge}
        </ComboboxPrimitive.Trigger>
        <ComboboxContent align="start" className="w-64">
          <ComboboxInput
            aria-label={t("moveTo")}
            maxLength={GEO_PRODUCT_NAME_MAX_LENGTH}
            placeholder={t("moveToPlaceholder")}
            showTrigger={false}
          />
          <ComboboxEmpty>{t("noProductMatches")}</ComboboxEmpty>
          <ComboboxList>
            {(item: string) =>
              item.startsWith(CREATE_PREFIX) ? (
                <ComboboxItem key={item} value={item}>
                  <HugeiconsIcon
                    className="text-muted-foreground size-3.5 shrink-0"
                    icon={PlusSignIcon}
                    strokeWidth={2}
                  />
                  <span className="shrink-0">{t("createProduct")}</span>
                  {/* Very long names are clipped by the popup width. */}
                  <span className="flex min-w-0 overflow-hidden rounded-md">
                    <StatusBadge
                      appearance={{
                        variant: geoProductBadgeVariant(products.length),
                      }}
                      label={label(item)}
                    />
                  </span>
                </ComboboxItem>
              ) : (
                <ComboboxItem key={item} value={item}>
                  <ProductDot
                    position={
                      item === NO_PRODUCT
                        ? null
                        : (byId.get(item)?.position ?? null)
                    }
                  />
                  <span className="truncate">{label(item)}</span>
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
