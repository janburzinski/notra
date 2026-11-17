const LEADING_AT = /^@/;

/** Reviewers as saved: no @, lowercase like GitHub compares them, once each. */
export function normalizeAutopilotReviewers(reviewers: readonly string[]) {
  return [
    ...new Set(
      reviewers.map((reviewer) =>
        reviewer.trim().replace(LEADING_AT, "").toLowerCase()
      )
    ),
  ];
}

/**
 * The workspace's reviewers as GitHub's request takes them. A team is named
 * by its slug and must belong to the repository's organization; teams of
 * another one are left out, since GitHub would refuse the whole request.
 */
export function splitAutopilotReviewers(
  reviewers: readonly string[],
  repositoryOwner: string
) {
  const users: string[] = [];
  const teams: string[] = [];
  const otherTeams: string[] = [];
  for (const reviewer of normalizeAutopilotReviewers(reviewers)) {
    const [owner = "", team] = reviewer.split("/");
    if (!team) {
      users.push(owner);
    } else if (owner === repositoryOwner.toLowerCase()) {
      teams.push(team);
    } else {
      otherTeams.push(reviewer);
    }
  }
  return { users, teams, otherTeams };
}
