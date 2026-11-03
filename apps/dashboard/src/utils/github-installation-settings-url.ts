/** GitHub page where an installation's repository access is changed. */
export function githubInstallationSettingsUrl(installation: {
  accountLogin: string;
  accountType: string;
  installationId: string;
}) {
  const id = encodeURIComponent(installation.installationId);
  return installation.accountType === "Organization"
    ? `https://github.com/organizations/${encodeURIComponent(installation.accountLogin)}/settings/installations/${id}`
    : `https://github.com/settings/installations/${id}`;
}
