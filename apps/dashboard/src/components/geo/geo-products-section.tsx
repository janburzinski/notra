"use client";

import {
  Delete02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GEO_PRODUCT_NAME_MAX_LENGTH,
  GEO_PRODUCT_NICHE_MAX_LENGTH,
  GEO_PRODUCTS_MAX,
} from "@notra/geo-core/constants/geo";
import type { GeoProduct } from "@notra/geo-core/types/geo";
import { Input } from "@notra/ui/components/ui/input";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TitleCard } from "@notra/ui/components/ui/title-card";
import { type FormEvent, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { GeoRemoveDialog } from "@/components/geo/geo-remove-dialog";
import { ProductDot } from "@/components/geo/product-dot";
import {
  useGeoProductCreate,
  useGeoProductDelete,
  useGeoProductUpdate,
  useGeoProducts,
} from "@/lib/hooks/use-geo";
import type {
  GeoProductEditRowProps,
  GeoProductsSectionProps,
} from "@/types/components/geo";

const NEW_PRODUCT = "new";

function GeoProductEditRow({
  product,
  pending,
  onSave,
  onCancel,
}: GeoProductEditRowProps) {
  const t = useTranslations("geo.geoSettingsForm.products");
  const tActions = useTranslations("common.actions");
  const [name, setName] = useState(product?.name ?? "");
  const [niche, setNiche] = useState(product?.niche ?? "");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), niche: niche.trim() || null });
    }
  };

  return (
    <form
      className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center"
      onSubmit={handleSubmit}
    >
      <Input
        aria-label={t("name")}
        autoFocus
        className="sm:w-48"
        disabled={pending}
        maxLength={GEO_PRODUCT_NAME_MAX_LENGTH}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("namePlaceholder")}
        value={name}
      />
      <Input
        aria-label={t("niche")}
        className="min-w-0 flex-1"
        disabled={pending}
        maxLength={GEO_PRODUCT_NICHE_MAX_LENGTH}
        onChange={(event) => setNiche(event.target.value)}
        placeholder={t("nichePlaceholder")}
        value={niche}
      />
      <div className="flex shrink-0 gap-2">
        <Button
          disabled={pending}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="outline"
        >
          {tActions("cancel")}
        </Button>
        <Button
          disabled={pending || !name.trim()}
          loading={pending}
          size="sm"
          type="submit"
        >
          {tActions("save")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The project's products: rename, describe, add or delete them. Prompts are
 * filed into products automatically, and the website is checked weekly.
 */
export function GeoProductsSection({
  organizationId,
}: GeoProductsSectionProps) {
  const t = useTranslations("geo.geoSettingsForm.products");
  const tActions = useTranslations("common.actions");
  const { data, isPending, isError, refetch } = useGeoProducts(organizationId);
  const products = data?.products ?? [];
  const create = useGeoProductCreate(organizationId);
  const update = useGeoProductUpdate(organizationId);
  const remove = useGeoProductDelete(organizationId);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<GeoProduct | null>(null);

  const save = (
    product: GeoProduct | null,
    values: { name: string; niche: string | null }
  ) => {
    const done = { onSuccess: () => setEditing(null) };
    if (product) {
      update.mutate({ productId: product.id, ...values }, done);
    } else {
      create.mutate(
        { name: values.name, niche: values.niche ?? undefined },
        done
      );
    }
  };

  return (
    <TitleCard as="section" heading={t("title")} headingAs="h2">
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs text-pretty">
          {t("description")}
        </p>
        {isPending ? (
          <div aria-busy="true" className="space-y-3 py-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : null}
        {isError ? (
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground text-sm">{t("loadFailed")}</p>
            <Button onClick={() => refetch()} size="sm" variant="outline">
              {tActions("retry")}
            </Button>
          </div>
        ) : null}
        {data && products.length > 0 ? (
          <ul className="divide-border divide-y">
            {products.map((product) =>
              editing === product.id ? (
                <li key={product.id}>
                  <GeoProductEditRow
                    onCancel={() => setEditing(null)}
                    onSave={(values) => save(product, values)}
                    pending={update.isPending}
                    product={product}
                  />
                </li>
              ) : (
                <li className="flex items-center gap-3 py-2.5" key={product.id}>
                  <ProductDot position={product.position} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {product.name}
                    </p>
                    {product.niche ? (
                      <p className="text-muted-foreground truncate text-xs">
                        {product.niche}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    aria-label={t("editAria", { name: product.name })}
                    onClick={() => setEditing(product.id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
                  </Button>
                  <Button
                    aria-label={t("deleteAria", { name: product.name })}
                    onClick={() => setDeleting(product)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                  </Button>
                </li>
              )
            )}
          </ul>
        ) : null}
        {data && products.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : null}
        {data && editing === NEW_PRODUCT ? (
          <GeoProductEditRow
            onCancel={() => setEditing(null)}
            onSave={(values) => save(null, values)}
            pending={create.isPending}
            product={null}
          />
        ) : null}
        {data && editing !== NEW_PRODUCT ? (
          <Button
            disabled={products.length >= GEO_PRODUCTS_MAX}
            onClick={() => setEditing(NEW_PRODUCT)}
            size="sm"
            variant="outline"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={14} />
            {t("add")}
          </Button>
        ) : null}
      </div>
      <GeoRemoveDialog
        actionLabel={t("deleteConfirm")}
        description={t("deleteDescription")}
        isPending={remove.isPending}
        items={deleting ? [deleting.name] : []}
        nouns={{ singular: t("noun"), plural: t("nounPlural") }}
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, { onSettled: () => setDeleting(null) });
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        open={deleting !== null}
        title={deleting ? t("deleteTitle", { name: deleting.name }) : undefined}
      />
    </TitleCard>
  );
}
