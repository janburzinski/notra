import type { RepoStarData } from "@/types/star-video";

export async function fetchRepoStarData(
  owner: string,
  repo: string,
  signal: AbortSignal
) {
  try {
    const response = await fetch(
      `/api/star-video/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      { signal }
    );
    if (!response.ok) {
      const json: { error?: string } = await response.json().catch(() => ({}));
      return {
        data: null,
        error: json.error ?? "Could not load that repository.",
      };
    }

    const data: RepoStarData = await response.json();
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: "Unable to load that repository. Check your connection and try again.",
    };
  }
}
