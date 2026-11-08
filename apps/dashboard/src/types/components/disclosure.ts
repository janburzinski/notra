import type { ReactNode } from "react";

export interface DisclosureProps {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}
