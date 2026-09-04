import { Data, Effect } from "effect";

import {
  GITHUB_SEARCH_PAGE_SIZE,
  MAX_GITHUB_SEARCH_PAGES,
} from "@/constants/pr-merge-video";
import type {
  GithubGraphqlResponse,
  GithubPrMergeActor,
  GithubPrMergeSearchData,
  PrMergePeriodDays,
  PrMergePerson,
  RepoPrMergeData,
} from "@/types/pr-merge-video";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const HTTP_UNAUTHORIZED = 401;

const PR_MERGE_QUERY = `
  query PrMerges(
    $owner: String!
    $repo: String!
    $queryString: String!
    $after: String
  ) {
    repository(owner: $owner, name: $repo) {
      name
      nameWithOwner
      url
      isPrivate
    }
    search(
      query: $queryString
      type: ISSUE
      first: ${GITHUB_SEARCH_PAGE_SIZE}
      after: $after
    ) {
      issueCount
      nodes {
        ... on PullRequest {
          mergedAt
          mergedBy {
            __typename
            login
            avatarUrl(size: 280)
            ... on User {
              name
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

class RepoNotFound extends Data.TaggedError("RepoNotFound")<{
  readonly owner: string;
  readonly repo: string;
}> {}

class RepoUnavailable extends Data.TaggedError("RepoUnavailable")<{
  readonly owner: string;
  readonly repo: string;
}> {}

class RepoUnauthorized extends Data.TaggedError("RepoUnauthorized")<{
  readonly owner: string;
  readonly repo: string;
}> {}

function buildFetchOptions(
  owner: string,
  repo: string,
  queryString: string,
  after: string | null,
  token: string
): RequestInit {
  return {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "notra-pr-merge-video",
    },
    body: JSON.stringify({
      query: PR_MERGE_QUERY,
      variables: { owner, repo, queryString, after },
    }),
    cache: "no-store",
  };
}

async function fetchPage(
  owner: string,
  repo: string,
  queryString: string,
  after: string | null,
  token: string
): Promise<{
  status: number;
  payload: GithubGraphqlResponse<GithubPrMergeSearchData> | null;
}> {
  try {
    const response = await fetch(
      GITHUB_GRAPHQL_URL,
      buildFetchOptions(owner, repo, queryString, after, token)
    );
    const payload = (await response
      .json()
      .catch(
        () => null
      )) as GithubGraphqlResponse<GithubPrMergeSearchData> | null;
    return { status: response.status, payload };
  } catch {
    return { status: 0, payload: null };
  }
}

function isHumanActor(typename: string, login: string): boolean {
  return typename === "User" && !login.toLowerCase().endsWith("[bot]");
}

function addMerge(
  people: Map<string, PrMergePerson>,
  actor: GithubPrMergeActor | null
): void {
  if (!(actor && isHumanActor(actor.__typename, actor.login))) {
    return;
  }

  const key = actor.login.toLowerCase();
  const existing = people.get(key);
  if (existing) {
    existing.merges += 1;
    return;
  }

  people.set(key, {
    login: actor.login,
    name: actor.name?.trim() || null,
    avatarUrl: actor.avatarUrl,
    merges: 1,
  });
}

export const fetchRepoPrMergeData = Effect.fn("fetchRepoPrMergeData")(
  function* (
    owner: string,
    repo: string,
    days: PrMergePeriodDays,
    token: string,
    now = new Date()
  ) {
    const cutoff = new Date(
      now.getTime() - days * MILLISECONDS_PER_DAY
    ).toISOString();
    const queryDate = cutoff.slice(0, 10);
    const queryString = `repo:${owner}/${repo} is:pr is:merged merged:>=${queryDate}`;
    const people = new Map<string, PrMergePerson>();

    let after: string | null = null;
    let repository: GithubPrMergeSearchData["repository"] = null;
    let fetchedSearchResultCount = 0;
    let issueCount = 0;
    let hasNextPage = false;

    for (let page = 0; page < MAX_GITHUB_SEARCH_PAGES; page += 1) {
      const pagePromise = fetchPage(owner, repo, queryString, after, token);
      const response = yield* Effect.promise(() => pagePromise);

      if (response.status === HTTP_UNAUTHORIZED) {
        return yield* Effect.fail(new RepoUnauthorized({ owner, repo }));
      }

      const data = response.payload?.data;
      if (!(response.status >= 200 && response.status < 300 && data)) {
        return yield* Effect.fail(new RepoUnavailable({ owner, repo }));
      }

      if (page === 0) {
        repository = data.repository;
        if (!repository || repository.isPrivate) {
          return yield* Effect.fail(new RepoNotFound({ owner, repo }));
        }
        issueCount = data.search.issueCount;
      }

      fetchedSearchResultCount += data.search.nodes.length;
      for (const node of data.search.nodes) {
        if (!(node?.mergedAt && node.mergedAt >= cutoff)) {
          continue;
        }
        addMerge(people, node.mergedBy);
      }

      hasNextPage = data.search.pageInfo.hasNextPage;
      after = data.search.pageInfo.endCursor;
      if (!(hasNextPage && after)) {
        break;
      }
    }

    if (!repository) {
      return yield* Effect.fail(new RepoNotFound({ owner, repo }));
    }

    const rankedPeople = [...people.values()].sort(
      (first, second) =>
        second.merges - first.merges || first.login.localeCompare(second.login)
    );
    const [resolvedOwner] = repository.nameWithOwner.split("/");

    return {
      id: repository.nameWithOwner.toLowerCase(),
      owner: resolvedOwner || owner,
      repo: repository.name,
      days,
      people: rankedPeople,
      htmlUrl: repository.url,
      totalMerges: rankedPeople.reduce(
        (total, person) => total + person.merges,
        0
      ),
      truncated: hasNextPage || issueCount > fetchedSearchResultCount,
    } satisfies RepoPrMergeData;
  }
);
