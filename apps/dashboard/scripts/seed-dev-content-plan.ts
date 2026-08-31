import { geoContentBriefSchema } from "@notra/ai/schemas/geo-writer";
import { db } from "@notra/db/drizzle";
import {
  brandSettings,
  geoContentBriefs,
  members,
  organizations,
  postCollections,
  posts,
  projects,
  users,
} from "@notra/db/schema";
import { GEO_WRITER_TRIGGER_ID } from "@notra/geo-core/constants/geo";
import { geoBriefToMarkdown } from "@notra/geo-core/utils/geo-writer-brief-markdown";
import { WorkOS } from "@workos-inc/node";
import { and, eq } from "drizzle-orm";

const DEMO_EMAIL = "dev.plan@notra.sh";
const DEMO_NAME = "Dev Plan";
const ORG_SLUG = "dev-plan";
const ORG_NAME = "Notra Dev Plan";
const PLAN_SLUG = "dev-plan-generic-ai-alternatives";

const BRIEF = geoContentBriefSchema.parse({
  targetPrompt: "What is a good alternative to generic AI content generators?",
  intent:
    "The buyer wants a tool that plans and writes on-brand articles instead of dumping generic copy.",
  contentSubtype: "alternatives",
  workingTitle:
    "Alternatives to Generic AI Content Generators: How to Pick the Right One",
  audience:
    "Founders, engineering leads, and content teams at B2B SaaS companies",
  jobToBeDone:
    "Help the reader pick a generator that can follow a brief instead of dumping generic copy.",
  sections: [
    {
      heading: "What's a good alternative to generic AI content generators?",
      goal: "Give a direct answer in the first 100 words and name the category.",
      claims: [
        "A brief-first writer beats a one-shot generator for GEO articles.",
        "The reader should see the plan before any draft exists.",
      ],
    },
    {
      heading: "How should you evaluate an alternative?",
      goal: "Give a checklist the reader can reuse in a buying conversation.",
      claims: [
        "Look for a visible plan, brand voice, and internal links from a sitemap.",
      ],
    },
    {
      heading: "When is a generic generator still enough?",
      goal: "Draw a clear line so the article is not a hit piece.",
      claims: [
        "Use a generic generator for internal notes, not buyer-facing GEO pages.",
      ],
    },
  ],
  questionsToAnswer: [
    "What should a content plan include before writing starts?",
    "Can I refine the plan after the first outline?",
  ],
  internalLinks: [],
  acceptanceChecklist: [
    "Answer the target prompt in the first 100 words.",
    "Use H2 headings that match questions people ask AI assistants.",
  ],
});

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function generatePassword(): string {
  return `Notra-Dev-${crypto.randomUUID().slice(0, 8)}-Plan!9`;
}

async function ensureWorkOSUser(
  workos: WorkOS,
  email: string,
  password: string
) {
  const listed = await workos.userManagement.listUsers({ email });
  const existing = listed.data[0];
  if (existing) {
    const updated = await workos.userManagement.updateUser({
      userId: existing.id,
      password,
      emailVerified: true,
      firstName: "Dev",
      lastName: "Plan",
    });
    return updated;
  }

  return workos.userManagement.createUser({
    email,
    password,
    firstName: "Dev",
    lastName: "Plan",
    emailVerified: true,
  });
}

async function ensureLocalUser(workosUserId: string) {
  const byWorkos = await db.query.users.findFirst({
    where: eq(users.workosUserId, workosUserId),
  });
  if (byWorkos) {
    await db
      .update(users)
      .set({
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        emailVerified: true,
      })
      .where(eq(users.id, byWorkos.id));
    return byWorkos.id;
  }

  const byEmail = await db.query.users.findFirst({
    where: eq(users.email, DEMO_EMAIL),
  });
  if (byEmail) {
    await db
      .update(users)
      .set({
        workosUserId,
        emailVerified: true,
        name: DEMO_NAME,
      })
      .where(eq(users.id, byEmail.id));
    return byEmail.id;
  }

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    name: DEMO_NAME,
    email: DEMO_EMAIL,
    emailVerified: true,
    workosUserId,
  });
  return id;
}

async function ensureOrganization(localUserId: string, workos: WorkOS) {
  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.slug, ORG_SLUG),
  });
  const now = new Date();
  const organizationId = existing?.id ?? crypto.randomUUID();

  if (!existing) {
    await db.insert(organizations).values({
      id: organizationId,
      name: ORG_NAME,
      slug: ORG_SLUG,
      createdAt: now,
      onboardingCompleted: true,
      onboardingDismissed: true,
    });
  } else {
    await db
      .update(organizations)
      .set({
        onboardingCompleted: true,
        onboardingDismissed: true,
      })
      .where(eq(organizations.id, organizationId));
  }

  const existingMembership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.userId, localUserId)
    ),
  });
  if (!existingMembership) {
    await db.insert(members).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: localUserId,
      role: "owner",
      createdAt: now,
    });
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { workosOrgId: true, name: true },
  });

  let workosOrgId = org?.workosOrgId ?? null;
  if (!workosOrgId) {
    try {
      const created = await workos.organizations.createOrganization({
        name: ORG_NAME,
        externalId: organizationId,
      });
      workosOrgId = created.id;
    } catch {
      const found =
        await workos.organizations.getOrganizationByExternalId(organizationId);
      workosOrgId = found.id;
    }
    await db
      .update(organizations)
      .set({ workosOrgId })
      .where(eq(organizations.id, organizationId));
  }

  const localUser = await db.query.users.findFirst({
    where: eq(users.id, localUserId),
    columns: { workosUserId: true },
  });
  if (workosOrgId && localUser?.workosUserId) {
    try {
      await workos.userManagement.createOrganizationMembership({
        organizationId: workosOrgId,
        userId: localUser.workosUserId,
        roleSlug: "owner",
      });
    } catch {
      const listed = await workos.userManagement.listOrganizationMemberships({
        organizationId: workosOrgId,
        userId: localUser.workosUserId,
      });
      if (listed.data.length === 0) {
        await workos.userManagement.createOrganizationMembership({
          organizationId: workosOrgId,
          userId: localUser.workosUserId,
          roleSlug: "admin",
        });
      }
    }
  }

  return organizationId;
}

async function ensureBrandAndProject(organizationId: string) {
  const existingBrand = await db.query.brandSettings.findFirst({
    where: eq(brandSettings.organizationId, organizationId),
  });
  const brandId = existingBrand?.id ?? crypto.randomUUID();
  if (!existingBrand) {
    await db.insert(brandSettings).values({
      id: brandId,
      organizationId,
      name: "Notra",
      isDefault: true,
      websiteUrl: "https://notra.sh",
      companyName: ORG_NAME,
      audience: BRIEF.audience,
      language: "English",
    });
  }

  const existingProject = await db.query.projects.findFirst({
    where: eq(projects.organizationId, organizationId),
  });
  const projectId = existingProject?.id ?? crypto.randomUUID();
  if (!existingProject) {
    await db.insert(projects).values({
      id: projectId,
      organizationId,
      name: "Default",
      brandSettingsId: brandId,
    });
  }

  return { brandId, projectId, brandName: existingBrand?.name ?? "Notra" };
}

async function ensurePlan(input: {
  organizationId: string;
  projectId: string;
  brandId: string;
  brandName: string;
  userId: string;
}) {
  const existing = await db.query.geoContentBriefs.findFirst({
    where: eq(geoContentBriefs.organizationId, input.organizationId),
  });
  if (existing?.postId && existing.status === "draft") {
    return existing.postId;
  }

  const briefId = crypto.randomUUID();
  const collectionId = crypto.randomUUID();
  const postId = crypto.randomUUID();
  const markdown = geoBriefToMarkdown(BRIEF);
  const now = new Date();
  const sourceMetadata = {
    triggerId: GEO_WRITER_TRIGGER_ID,
    triggerSourceType: "geo",
    prompt: BRIEF.targetPrompt,
    brandVoiceId: input.brandId,
    brandVoiceName: input.brandName,
    briefId,
    projectId: input.projectId,
  };

  await db.insert(postCollections).values({
    id: collectionId,
    organizationId: input.organizationId,
    source: "manual",
    sourceId: briefId,
    name: "Blog post",
    nameSource: "generated",
    contentTypes: ["blog_post"],
    sourceMetadata,
    expectedPostCount: 1,
    completedPostCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(posts).values({
    id: postId,
    organizationId: input.organizationId,
    collectionId,
    title: BRIEF.workingTitle,
    slug: PLAN_SLUG,
    content: `<p>${BRIEF.targetPrompt}</p>`,
    markdown,
    contentType: "blog_post",
    contentSubtype: BRIEF.contentSubtype,
    sourceMetadata,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(geoContentBriefs).values({
    id: briefId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    brandSettingsId: input.brandId,
    createdByUserId: input.userId,
    topic: BRIEF.targetPrompt,
    brief: BRIEF,
    status: "draft",
    autoApproved: false,
    collectionId,
    postId,
    humanized: false,
    sourceKind: "manual",
    createdAt: now,
    updatedAt: now,
  });

  return postId;
}

async function seed() {
  const apiKey = requireEnv("WORKOS_API_KEY");
  requireEnv("DATABASE_URL");
  const password = generatePassword();
  const workos = new WorkOS(apiKey);
  const workosUser = await ensureWorkOSUser(workos, DEMO_EMAIL, password);
  const localUserId = await ensureLocalUser(workosUser.id);
  const organizationId = await ensureOrganization(localUserId, workos);
  const { brandId, projectId, brandName } =
    await ensureBrandAndProject(organizationId);
  const postId = await ensurePlan({
    organizationId,
    projectId,
    brandId,
    brandName,
    userId: localUserId,
  });

  const origin = appUrl();
  console.log(
    JSON.stringify(
      {
        email: DEMO_EMAIL,
        password,
        loginUrl: `${origin}/login`,
        planUrl: `${origin}/${ORG_SLUG}/content/${postId}`,
        orgSlug: ORG_SLUG,
      },
      null,
      2
    )
  );
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
