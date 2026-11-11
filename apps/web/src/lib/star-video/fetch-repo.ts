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
      const json: { error?: string; needsPrivateAccess?: boolean } =
        await response.json().catch(() => ({}));
      return {
        data: null,
        error: json.error ?? "Could not load that repository.",
        needsPrivateAccess: json.needsPrivateAccess === true,
      };
    }

    const data: RepoStarData = await response.json();
    return { data, error: null, needsPrivateAccess: false };
  } catch {
    return {
      data: null,
      error: "Something went wrong loading that repository.",
      needsPrivateAccess: false,
    };
  }
}
