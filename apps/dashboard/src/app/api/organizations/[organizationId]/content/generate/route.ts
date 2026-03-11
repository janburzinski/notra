import { db } from "@notra/db/drizzle";
import type { PostSourceMetadata } from "@notra/db/schema";
import { brandSettings, githubIntegrations } from "@notra/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { FEATURES } from "@/constants/features";
import { withOrganizationAuth } from "@/lib/auth/organization";
import { autumn } from "@/lib/billing/autumn";
import { generateScheduledContent } from "@/lib/workflows/schedule/handlers";
import { getValidToneProfile } from "@/schemas/brand";
import {
  createOnDemandContentSchema,
  type SelectedItems,
} from "@/schemas/content";
import type { GitHubSelectionFilters } from "@/types/ai/tools";
import { formatUtcTodayContext, resolveLookbackRange } from "@/utils/lookback";

export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ organizationId: string }>;
}

async function resolveBrandVoiceForManualGeneration(
  organizationId: string,
  brandVoiceId?: string
) {
  if (brandVoiceId) {
    const explicitVoice = await db.query.brandSettings.findFirst({
      where: and(
        eq(brandSettings.id, brandVoiceId),
        eq(brandSettings.organizationId, organizationId)
      ),
    });

    if (!explicitVoice) {
      return { brand: null, invalidRequestedVoice: true } as const;
    }

    return { brand: explicitVoice, invalidRequestedVoice: false } as const;
  }

  const defaultVoice = await db.query.brandSettings.findFirst({
    where: and(
      eq(brandSettings.organizationId, organizationId),
      eq(brandSettings.isDefault, true)
    ),
  });

  if (defaultVoice) {
    return { brand: defaultVoice, invalidRequestedVoice: false } as const;
  }

  const latestVoice = await db.query.brandSettings.findFirst({
    where: eq(brandSettings.organizationId, organizationId),
    orderBy: [desc(brandSettings.updatedAt)],
  });

  return { brand: latestVoice ?? null, invalidRequestedVoice: false } as const;
}

function hasSelectedItemsOutsideTargets(
  selectedItems: SelectedItems,
  targetRepositoryIds: Set<string>
) {
  if (!selectedItems) {
    return false;
  }

  if (
    selectedItems.pullRequestNumbers?.some(
      (item) => !targetRepositoryIds.has(item.repositoryId)
    )
  ) {
    return true;
  }

  if (
    selectedItems.releaseTagNames?.some(
      (item) =>
        typeof item !== "string" && !targetRepositoryIds.has(item.repositoryId)
    )
  ) {
    return true;
  }

  return false;
}

function buildSelectionFilters(
  selectedItems: SelectedItems,
  targetRepositoryIds: Set<string>,
  dataPoints: {
    includePullRequests: boolean;
    includeCommits: boolean;
    includeReleases: boolean;
  }
): GitHubSelectionFilters | undefined {
  if (!selectedItems) {
    return undefined;
  }

  const hasPullRequestSelection =
    dataPoints.includePullRequests &&
    Object.hasOwn(selectedItems, "pullRequestNumbers");
  const hasReleaseSelection =
    dataPoints.includeReleases &&
    Object.hasOwn(selectedItems, "releaseTagNames");
  const hasCommitSelection =
    dataPoints.includeCommits && Object.hasOwn(selectedItems, "commitShas");

  if (!hasPullRequestSelection && !hasReleaseSelection && !hasCommitSelection) {
    return undefined;
  }

  const pullRequestByIntegrationId: Record<string, number[]> = {};
  if (hasPullRequestSelection) {
    for (const repositoryId of targetRepositoryIds) {
      pullRequestByIntegrationId[repositoryId] = [];
    }
    for (const item of selectedItems.pullRequestNumbers ?? []) {
      if (!targetRepositoryIds.has(item.repositoryId)) {
        continue;
      }
      pullRequestByIntegrationId[item.repositoryId]?.push(item.number);
    }
  }

  const releaseTagsByIntegrationId: Record<string, string[]> = {};
  const globalReleaseTags: string[] = [];
  if (hasReleaseSelection) {
    for (const repositoryId of targetRepositoryIds) {
      releaseTagsByIntegrationId[repositoryId] = [];
    }
    for (const item of selectedItems.releaseTagNames ?? []) {
      if (typeof item === "string") {
        globalReleaseTags.push(item);
        continue;
      }

      if (!targetRepositoryIds.has(item.repositoryId)) {
        continue;
      }

      releaseTagsByIntegrationId[item.repositoryId]?.push(item.tagName);
    }
  }

  const commitShas =
    (hasCommitSelection ? selectedItems.commitShas : undefined)
      ?.map((sha) => sha.trim())
      .filter((sha) => sha.length > 0) ?? [];

  return {
    allowedPullRequestNumbersByIntegrationId: hasPullRequestSelection
      ? pullRequestByIntegrationId
      : undefined,
    allowedReleaseTagsByIntegrationId: hasReleaseSelection
      ? releaseTagsByIntegrationId
      : undefined,
    allowedReleaseTagsGlobal:
      hasReleaseSelection && globalReleaseTags.length > 0
        ? globalReleaseTags
        : undefined,
    allowedCommitShas: hasCommitSelection ? commitShas : undefined,
  };
}

function buildSelectedItemsInstructions(
  selectedItems: SelectedItems
): string | null {
  if (!selectedItems) {
    return null;
  }

  const parts: string[] = [];

  if (selectedItems.commitShas && selectedItems.commitShas.length > 0) {
    parts.push(
      `Focus ONLY on these specific commits (by SHA): ${selectedItems.commitShas.join(", ")}`
    );
  }

  if (
    selectedItems.pullRequestNumbers &&
    selectedItems.pullRequestNumbers.length > 0
  ) {
    const prList = selectedItems.pullRequestNumbers
      .map((pr) => `#${pr.number} (repo: ${pr.repositoryId})`)
      .join(", ");
    parts.push(`Focus ONLY on these specific pull requests: ${prList}`);
  }

  if (
    selectedItems.releaseTagNames &&
    selectedItems.releaseTagNames.length > 0
  ) {
    const releaseList = selectedItems.releaseTagNames
      .map((release) =>
        typeof release === "string"
          ? release
          : `${release.tagName} (repo: ${release.repositoryId})`
      )
      .join(", ");
    parts.push(`Focus ONLY on these specific releases: ${releaseList}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `Selected items filter (IMPORTANT — only include content about these specific items, ignore all others):\n${parts.join("\n")}`;
}

function buildDataPointRestrictionInstructions(dataPoints: {
  includePullRequests: boolean;
  includeCommits: boolean;
  includeReleases: boolean;
  includeLinearIssues: boolean;
}) {
  const restrictions: string[] = [];

  if (!dataPoints.includePullRequests) {
    restrictions.push(
      "- Exclude pull request data entirely. Do not mention PR numbers, PR titles, PR authors, or PR-based summaries."
    );
  }

  if (!dataPoints.includeCommits) {
    restrictions.push(
      "- Exclude commit data entirely. Do not mention commit hashes, commit counts, or commit-level changes."
    );
  }

  if (!dataPoints.includeReleases) {
    restrictions.push(
      "- Exclude release data entirely. Do not mention release tags, release names, or release-based summaries."
    );
  }

  if (!dataPoints.includeLinearIssues) {
    restrictions.push(
      "- Exclude Linear issue data entirely. Do not mention issue IDs, titles, statuses, or issue-based summaries."
    );
  }

  if (restrictions.length === 0) {
    return null;
  }

  return `Strict data-point restrictions:\n${restrictions.join("\n")}`;
}

async function refundReservedAiCredit(
  organizationId: string,
  reserved: boolean
) {
  if (!reserved || !autumn) {
    return;
  }

  const { error } = await autumn.track({
    customer_id: organizationId,
    feature_id: FEATURES.AI_CREDITS,
    value: 0,
  });

  if (error) {
    console.error("[OnDemandContent] Failed to refund AI credit", {
      organizationId,
      error,
    });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  let organizationId: string | null = null;
  let aiCreditReserved = false;

  try {
    ({ organizationId } = await params);
    const auth = await withOrganizationAuth(request, organizationId);

    if (!auth.success) {
      return auth.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const bodyValidation = createOnDemandContentSchema.safeParse(body);

    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: bodyValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      contentType,
      lookbackWindow,
      repositoryIds,
      selectedItems,
      brandVoiceId,
      dataPoints,
    } = bodyValidation.data;

    if (dataPoints.includeLinearIssues) {
      return NextResponse.json(
        {
          error:
            "Linear Issues are not supported in manual content generation yet.",
        },
        { status: 400 }
      );
    }

    const [repositories, brandResult] = await Promise.all([
      db
        .select({
          id: githubIntegrations.id,
          owner: githubIntegrations.owner,
          repo: githubIntegrations.repo,
          defaultBranch: githubIntegrations.defaultBranch,
        })
        .from(githubIntegrations)
        .where(
          and(
            eq(githubIntegrations.organizationId, organizationId),
            eq(githubIntegrations.enabled, true)
          )
        ),
      resolveBrandVoiceForManualGeneration(organizationId, brandVoiceId),
    ]);
    const brand = brandResult.brand;

    if (brandResult.invalidRequestedVoice) {
      return NextResponse.json(
        { error: "Requested brand voice was not found for this organization." },
        { status: 400 }
      );
    }

    const validRepositories = repositories.filter(
      (
        repository
      ): repository is (typeof repositories)[number] & {
        owner: string;
        repo: string;
      } => Boolean(repository.owner && repository.repo)
    );

    if (validRepositories.length === 0) {
      return NextResponse.json(
        { error: "No active GitHub repositories connected" },
        { status: 400 }
      );
    }

    const targetRepositories =
      repositoryIds && repositoryIds.length > 0
        ? validRepositories.filter((repository) =>
            repositoryIds.includes(repository.id)
          )
        : validRepositories;

    if (targetRepositories.length === 0) {
      return NextResponse.json(
        { error: "No valid target repositories selected" },
        { status: 400 }
      );
    }

    const targetRepositoryIds = new Set(
      targetRepositories.map((repository) => repository.id)
    );
    if (hasSelectedItemsOutsideTargets(selectedItems, targetRepositoryIds)) {
      return NextResponse.json(
        {
          error:
            "Selected items must belong to repositories included in this generation request.",
        },
        { status: 400 }
      );
    }
    const selectionFilters = buildSelectionFilters(
      selectedItems,
      targetRepositoryIds,
      dataPoints
    );

    if (autumn) {
      const { data, error } = await autumn.check({
        customer_id: organizationId,
        feature_id: FEATURES.AI_CREDITS,
        required_balance: 1,
        send_event: true,
      });

      if (error) {
        throw new Error(`Autumn check failed: ${String(error)}`);
      }

      if (!data?.allowed) {
        return NextResponse.json(
          { error: "AI credit limit reached" },
          { status: 402 }
        );
      }

      aiCreditReserved = true;
    }

    const lookback = resolveLookbackRange(lookbackWindow);
    const todayUtc = formatUtcTodayContext(lookback.end);

    const restrictionInstructions =
      buildDataPointRestrictionInstructions(dataPoints);
    const selectedItemsInstructions =
      buildSelectedItemsInstructions(selectedItems);
    const customInstructions = [
      brand?.customInstructions?.trim() || "",
      restrictionInstructions || "",
      selectedItemsInstructions || "",
    ]
      .filter((value) => value.length > 0)
      .join("\n\n");

    const sourceMetadata: PostSourceMetadata = {
      triggerId: "manual_on_demand",
      triggerSourceType: "manual",
      repositories: targetRepositories.map((repository) => ({
        owner: repository.owner,
        repo: repository.repo,
      })),
      lookbackWindow,
      lookbackRange: {
        start: lookback.start.toISOString(),
        end: lookback.end.toISOString(),
      },
    };
    const sourceTargets = targetRepositories
      .map(
        (repository) =>
          `${repository.owner}/${repository.repo} (integrationId: ${repository.id})`
      )
      .join(", ");

    const result = await generateScheduledContent(contentType, {
      organizationId,
      repositories: targetRepositories.map((repository) => ({
        integrationId: repository.id,
        owner: repository.owner,
        repo: repository.repo,
        defaultBranch: repository.defaultBranch,
      })),
      tone: getValidToneProfile(brand?.toneProfile, "Conversational"),
      promptInput: {
        sourceTargets,
        todayUtc,
        lookbackLabel: lookback.label,
        lookbackStartIso: lookback.start.toISOString(),
        lookbackEndIso: lookback.end.toISOString(),
        companyName: brand?.companyName ?? undefined,
        companyDescription: brand?.companyDescription ?? undefined,
        audience: brand?.audience ?? undefined,
        customInstructions: customInstructions || null,
        language: brand?.language ?? undefined,
      },
      sourceMetadata,
      dataPointSettings: dataPoints,
      selectionFilters,
      commitWindow: {
        since: lookback.start.toISOString(),
        until: lookback.end.toISOString(),
      },
    });

    if (result.status === "rate_limited") {
      await refundReservedAiCredit(organizationId, aiCreditReserved);
      return NextResponse.json(
        {
          error: "GitHub API rate limit reached. Please retry shortly.",
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    if (result.status === "unsupported_output_type") {
      await refundReservedAiCredit(organizationId, aiCreditReserved);
      return NextResponse.json(
        { error: `Unsupported content type: ${result.outputType}` },
        { status: 400 }
      );
    }

    if (result.status === "generation_failed") {
      await refundReservedAiCredit(organizationId, aiCreditReserved);
      return NextResponse.json(
        { error: result.reason || "Failed to generate content" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      title: result.title,
    });
  } catch (error) {
    if (organizationId) {
      await refundReservedAiCredit(organizationId, aiCreditReserved);
    }

    console.error("Error generating on-demand content:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
