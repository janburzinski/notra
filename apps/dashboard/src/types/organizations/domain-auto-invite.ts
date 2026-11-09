export interface EmailIdentity {
  email: string;
  emailVerified: boolean;
}

export interface DomainAutoInviteState {
  /** Domain whose new signups are invited, or null when the setting is off. */
  enabledDomain: string | null;
  /** The caller's own verified company domain, the only one they may enable. */
  eligibleDomain: string | null;
  canManage: boolean;
}
