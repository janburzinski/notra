import { GEO_PRODUCT_DOT_CLASSES } from "@/constants/geo-prompts";
import { cn } from "@/lib/utils";
import { geoProductBadgeVariant } from "@/utils/geo-prompts";

/** A product's badge color as a dot; null draws the dashed "No product" dot. */
export function ProductDot({ position }: { position: number | null }) {
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
