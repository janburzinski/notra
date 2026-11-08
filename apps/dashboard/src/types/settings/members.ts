export interface InviteMemberPopoverProps {
  organizationId: string;
}

export type InviteRole = "member" | "admin";

export interface InviteMemberFormValues {
  email: string;
  role: InviteRole;
}
