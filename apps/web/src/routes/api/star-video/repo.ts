import { createFileRoute } from "@tanstack/react-router";

import { GITHUB_CONNECTION_REQUIRED_MESSAGE } from "@/lib/star-video/github-cookies";
import {
  clearGithubCookies,
  readGithubToken,
} from "@/lib/star-video/github-oauth";
import { loadRepoStarData } from "@/lib/star-video/load-repo";
import { repoQuerySchema } from "@/schemas/star-video";

async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = repoQuerySchema.safeParse({
    owner: searchParams.get("owner") ?? "",
    repo: searchParams.get("repo") ?? "",
  });

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid repository" },
      { status: 400 }
    );
  }

  const { owner, repo } = parsed.data;
  const id = `${owner}/${repo}`.toLowerCase();
  const githubToken = readGithubToken();
  if (!githubToken) {
    return Response.json(
      { error: GITHUB_CONNECTION_REQUIRED_MESSAGE },
      { status: 401 }
    );
  }

  const result = await loadRepoStarData(owner, repo, id, githubToken);
  if (!result.ok) {
    if (result.kind === "unauthorized") {
      const response = Response.json(
        { error: GITHUB_CONNECTION_REQUIRED_MESSAGE },
        { status: 401 }
      );
      clearGithubCookies();
      return response;
    }
    if (result.kind === "unavailable") {
      return Response.json(
        { error: "GitHub is unavailable right now. Please try again." },
        { status: 503 }
      );
    }
    if (result.kind === "private-access-needed") {
      return Response.json(
        {
          error:
            "Repository not found. If it is private, allow access to your private repositories.",
          needsPrivateAccess: true,
        },
        { status: 404 }
      );
    }
    return Response.json({ error: "Repository not found." }, { status: 404 });
  }

  return Response.json(result.data);
}

export const Route = createFileRoute("/api/star-video/repo")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});
