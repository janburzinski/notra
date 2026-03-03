import { db } from "@notra/db/drizzle";
import type { PostSourceMetadata } from "@notra/db/schema";
import { brandSettings, githubIntegrations } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { FEATURES } from "@/constants/features";
import { withOrganizationAuth } from "@/lib/auth/organization";
import { autumn } from "@/lib/billing/autumn";
import { generateScheduledContent } from "@/lib/workflows/schedule/handlers";
import { getValidToneProfile } from "@/schemas/brand";
import {
  contentDataPointSettingsSchema,
  createOnDemandContentSchema,
} from "@/schemas/content";
import { formatUtcTodayContext, resolveLookbackRange } from "@/utils/lookback";

interface RouteContext {
  params: Promise<{ organizationId: string }>;
}

function buildDataPointRestrictionInstructions(dataPoints: {
  includePullRequests: boolean;
  includeCommits: boolean;
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

    const { contentType, lookbackWindow, repositoryIds } = bodyValidation.data;
    const dataPoints = contentDataPointSettingsSchema.parse(
      bodyValidation.data.dataPoints ?? {}
    );

    const [repositories, brand] = await Promise.all([
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
      db.query.brandSettings.findFirst({
        where: eq(brandSettings.organizationId, organizationId),
      }),
    ]);

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
    const customInstructions = [
      brand?.customInstructions?.trim() || "",
      restrictionInstructions || "",
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
      },
      sourceMetadata,
      dataPointSettings: dataPoints,
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
