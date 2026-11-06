export interface PostAgentReachLoaderInput {
  organizationId: string;
  postId: string;
  days: number;
}

/**
 * Loads a post's agent reach as a JSON-friendly summary. Supplied by the host
 * app, since the loader lives in geo-core, which depends on this package.
 */
export type PostAgentReachLoader = (
  input: PostAgentReachLoaderInput
) => Promise<Record<string, unknown>>;

export interface PostAgentReachToolConfig {
  organizationId: string;
  loadPostAgentReach: PostAgentReachLoader;
}
