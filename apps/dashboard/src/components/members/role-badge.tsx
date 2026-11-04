"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const t = useTranslations("members");
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    owner: "default",
    admin: "secondary",
    member: "outline",
  };

  const roleValue = role || "member";

  return (
    <Badge variant={variants[roleValue] ?? "outline"}>
      {t("roleLabel", { role: roleValue })}
    </Badge>
  );
}
