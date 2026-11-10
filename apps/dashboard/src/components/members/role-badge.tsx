"use client";

import {
  Crown02Icon,
  Shield01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

const ROLE_STYLES = {
  owner: { icon: Crown02Icon, variant: "warning" },
  admin: { icon: Shield01Icon, variant: "info" },
  member: { icon: UserIcon, variant: "secondary" },
} as const;

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const t = useTranslations("members");
  const roleValue = role || "member";
  const style =
    ROLE_STYLES[roleValue as keyof typeof ROLE_STYLES] ?? ROLE_STYLES.member;

  return (
    <Badge shape="rounded" variant={style.variant}>
      <HugeiconsIcon
        aria-hidden="true"
        data-icon="inline-start"
        icon={style.icon}
        strokeWidth={2}
      />
      {t("roleLabel", { role: roleValue })}
    </Badge>
  );
}
