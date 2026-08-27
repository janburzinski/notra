import type { AvatarImage } from "@notra/ui/components/ui/avatar";
import type { ComponentProps, ReactNode } from "react";

export interface DomainLogoImageProps extends Omit<
  ComponentProps<typeof AvatarImage>,
  "src"
> {
  domain: string | null | undefined;
  fallback: ReactNode;
  onSettled?: () => void;
  preferredSources?: readonly (string | null | undefined)[];
}
