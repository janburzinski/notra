"use client";

import {
  Logout02Icon,
  Mail01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs, TabsContent } from "@notra/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "ui/table";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { useMemberColumns } from "@/components/members/columns";
import { DomainAutoInviteCard } from "@/components/members/domain-auto-invite-card";
import { useInvitationColumns } from "@/components/members/invitation-columns";
import { InviteMemberPopover } from "@/components/members/invite-member-popover";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { OrganizationMembershipActionDialog } from "@/components/settings/organization-membership-action-dialog";
import { SettingsPane } from "@/components/settings/settings-pane";
import { SettingsTableEmpty } from "@/components/settings/settings-table-empty";
import { TabCount } from "@/components/tab-count";
import { SETTINGS_TABLE_EMPTY_HEIGHT } from "@/constants/settings";
import { TABLE_ROW_HEIGHT } from "@/constants/table";
import { authClient } from "@/lib/auth/client";
import { useOrganizationMembershipAction } from "@/lib/hooks/use-organization-membership-action";
import { tableHeightFor } from "@/utils/table";

export function MembersSettingsPane() {
  const t = useTranslations("settings.panes.members");
  const tCommon = useTranslations("common");
  const tAction = useTranslations("settings.membershipAction");
  const memberColumns = useMemberColumns();
  const invitationColumns = useInvitationColumns();
  const { activeOrganization: organization } = useOrganizationsContext();
  const [activeTab, setActiveTab] = useState("members");

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["members", organization?.id],
    queryFn: async () => {
      if (!organization?.id) {
        return null;
      }
      const { data, error } = await authClient.organization.listMembers({
        query: {
          organizationId: organization.id,
        },
      });
      if (error) {
        throw new Error("Failed to fetch members");
      }
      return data;
    },
    enabled: !!organization?.id,
  });

  const members = membersData?.members;
  const { data: session } = authClient.useSession();
  const currentMember = members?.find(
    (member) => member.userId === session?.user?.id
  );
  const canLeave = !!currentMember && currentMember.role !== "owner";
  const { applyAction, isPending: isLeaving } = useOrganizationMembershipAction(
    organization,
    true
  );

  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ["invitations", organization?.id],
    queryFn: async () => {
      if (!organization?.id) {
        return [];
      }
      const { data, error } = await authClient.organization.listInvitations({
        query: {
          organizationId: organization.id,
        },
      });
      if (error) {
        throw new Error("Failed to fetch invitations");
      }
      return data ?? [];
    },
    enabled: !!organization?.id,
  });

  const pendingInvitations = invitations?.filter(
    (inv) => inv.status === "pending"
  );
  const pendingRowCount = invitationsLoading
    ? 3
    : (pendingInvitations?.length ?? 0);

  if (!organization) {
    return (
      <SettingsPane>
        <Skeleton className="h-64 rounded-lg" />
      </SettingsPane>
    );
  }

  return (
    <SettingsPane>
      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <IconTabsList aria-label={t("listsLabel")} value={activeTab}>
            <IconTabsTrigger
              icon={<HugeiconsIcon icon={UserGroupIcon} size={15} />}
              value="members"
            >
              {tCommon("labels.members")}
              <TabCount count={members?.length} />
            </IconTabsTrigger>
            <IconTabsTrigger
              icon={<HugeiconsIcon icon={Mail01Icon} size={15} />}
              value="pending"
            >
              {tCommon("labels.pending")}
              <TabCount count={pendingInvitations?.length} />
            </IconTabsTrigger>
          </IconTabsList>
          <div className="flex items-center gap-2">
            {canLeave ? (
              <OrganizationMembershipActionDialog
                action="leave"
                hasOtherMembers
                onConfirm={() => applyAction("leave")}
                organizationName={organization.name}
                trigger={
                  <Button loading={isLeaving} size="sm" variant="outline">
                    <HugeiconsIcon icon={Logout02Icon} size={16} />
                    {tAction("confirm", { action: "leave" })}
                  </Button>
                }
              />
            ) : null}
            <InviteMemberPopover organizationId={organization.id} />
          </div>
        </div>

        <TabsContent className="mt-4" value="members">
          <DataTable
            columns={memberColumns}
            data={members ?? []}
            emptyState={t("noMembers")}
            getRowId={(member) => member.id}
            height={tableHeightFor(membersLoading ? 3 : (members?.length ?? 0))}
            loading={membersLoading}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </TabsContent>

        <TabsContent className="mt-4" value="pending">
          <DataTable
            columns={invitationColumns}
            data={pendingInvitations ?? []}
            emptyState={
              <SettingsTableEmpty
                description={t("noPendingDescription")}
                icon={Mail01Icon}
                title={t("noPending")}
              />
            }
            getRowId={(invitation) => invitation.id}
            height={
              pendingRowCount > 0
                ? tableHeightFor(pendingRowCount)
                : SETTINGS_TABLE_EMPTY_HEIGHT
            }
            loading={invitationsLoading}
            rowHeight={TABLE_ROW_HEIGHT}
          />
        </TabsContent>
      </Tabs>
      <DomainAutoInviteCard
        organizationId={organization.id}
        organizationName={organization.name}
      />
    </SettingsPane>
  );
}
