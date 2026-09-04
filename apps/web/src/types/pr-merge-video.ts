import type { PR_MERGE_PERIODS } from "../constants/pr-merge-video";

export type PrMergePeriodDays = (typeof PR_MERGE_PERIODS)[number];

export interface PrMergePerson {
  login: string;
  name: string | null;
  avatarUrl: string;
  merges: number;
}

export type PrMergeVideoInputProps = {
  owner: string;
  repo: string;
  days: PrMergePeriodDays;
  people: PrMergePerson[];
};

export interface RepoPrMergeData extends PrMergeVideoInputProps {
  id: string;
  htmlUrl: string;
  totalMerges: number;
  truncated: boolean;
}

export interface PrMergeRowProps {
  person: PrMergePerson;
  index: number;
  total: number;
  fontFamily: string;
}

export type LoadRepoPrMergeResult =
  | { ok: true; data: RepoPrMergeData }
  | { ok: false; kind: "not-found" | "unavailable" | "unauthorized" };

export interface GithubPrMergeActor {
  __typename: string;
  login: string;
  name?: string | null;
  avatarUrl: string;
}

interface GithubPrMergeNode {
  mergedAt: string | null;
  mergedBy: GithubPrMergeActor | null;
}

export interface GithubPrMergeSearchData {
  repository: {
    name: string;
    nameWithOwner: string;
    url: string;
    isPrivate: boolean;
  } | null;
  search: {
    issueCount: number;
    nodes: Array<GithubPrMergeNode | null>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface GithubGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}
