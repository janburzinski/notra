import type { ContributorsData, GitHubUser } from "./github";

export interface ContributorsSectionHeaderProps {
  title: string;
  description: string;
}

export interface ContributorsGridProps {
  contributors: GitHubUser[];
}

export interface NotraAiCalloutProps {
  prCount: number;
}

export interface ContributorsContentProps {
  data: ContributorsData;
}
