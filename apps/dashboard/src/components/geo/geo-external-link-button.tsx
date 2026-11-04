import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/button";
import type { GeoExternalLinkButtonProps } from "@/types/geo";

export function GeoExternalLinkButton({
  href,
  label,
  icon,
  variant = "outline",
}: GeoExternalLinkButtonProps) {
  return (
    <Button
      nativeButton={false}
      render={<a href={href} rel="noopener" target="_blank" />}
      size="sm"
      variant={variant}
    >
      {icon}
      {label}
      <HugeiconsIcon icon={LinkSquare02Icon} />
    </Button>
  );
}
