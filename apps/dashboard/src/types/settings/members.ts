export interface InviteMemberPopoverProps {
  organizationId: string;
}

export interface DomainAutoInviteCardProps {
  organizationId: string;
  organizationName: string;
}

export type InviteRole = "member" | "admin";

export interface InviteMemberFormValues {
  email: string;
  role: InviteRole;
}
