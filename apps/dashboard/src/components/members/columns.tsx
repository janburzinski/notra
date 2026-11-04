"use client";

import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@notra/ui/components/ui/avatar";
import type { TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { getUserAvatarUrl } from "@/utils/avatar";
import { nameInitials } from "@/utils/name-initials";

import { MemberActions } from "./member-actions";
import { RoleBadge } from "./role-badge";

export interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

export function useMemberColumns(): TableColumn<Member>[] {
  const t = useTranslations("members.columns");
  const tCommon = useTranslations("common");
  return [
    {
      key: "user",
      header: t("user"),
      width: "1fr",
      minWidth: "12rem",
      sortValue: (member) => member.user.name,
      cell: (member) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar className="size-8 shrink-0">
            <AvatarImage
              alt={member.user.name || member.user.email}
              src={getUserAvatarUrl(member.user.image, member.user.email)}
            />
            <AvatarFallback>
              {nameInitials(member.user.name || member.user.email, 1)}
            </AvatarFallback>
          </Avatar>
          <TruncateWithTooltip className="font-medium">
            {member.user.name || member.user.email}
          </TruncateWithTooltip>
        </span>
      ),
    },
    {
      key: "email",
      header: tCommon("labels.email"),
      width: "1fr",
      minWidth: "12rem",
      sortValue: (member) => member.user.email,
      cell: (member) => (
        <TruncateWithTooltip className="text-muted-foreground">
          {member.user.email}
        </TruncateWithTooltip>
      ),
    },
    {
      key: "role",
      header: tCommon("labels.role"),
      width: "7rem",
      sortable: true,
      sortValue: (member) => member.role,
      cell: (member) => <RoleBadge role={member.role} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "3.5rem",
      minWidth: "3.5rem",
      cell: (member) => <MemberActions member={member} />,
    },
  ];
}
