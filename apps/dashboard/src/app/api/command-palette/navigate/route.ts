import { gateway } from "@notra/ai/gateway";
import { db } from "@notra/db/drizzle";
import { members, organizations } from "@notra/db/schema";
import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";
import { createRequestLogger } from "evlog";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { commandRoutesForAI } from "@/components/command-palette/registry";
import { getServerSession } from "@/lib/auth/session";
import { getClientIp, ratelimit } from "@/utils/ratelimit";

export const maxDuration = 15;

const requestSchema = z.object({
  query: z.string().min(1).max(500),
  slug: z.string().min(1).max(100),
});

const resultSchema = z.object({
  action: z.enum(["navigate", "chat"]),
  path: z.string().nullish(),
  reason: z.string().max(160).default(""),
});

export async function POST(request: NextRequest) {
  const log = createRequestLogger({
    method: "POST",
    path: "/api/command-palette/navigate",
  });

  const { session, user } = await getServerSession({
    headers: request.headers,
  });

  if (!(session && user)) {
    log.set({ feature: "command_palette", unauthorized: true });
    log.emit();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success, reset } = await ratelimit.commandPaletteNavigate.limit(
    user.id || getClientIp(request)
  );
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded", reset },
      { status: 429 }
    );
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { query, slug } = parsed.data;

  const membership = await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(and(eq(organizations.slug, slug), eq(members.userId, user.id)))
    .limit(1);

  if (membership.length === 0) {
    log.set({ feature: "command_palette", forbiddenSlug: true });
    log.emit();
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routes = commandRoutesForAI(slug);

  try {
    const { object } = await generateObject({
      model: gateway("openai/gpt-oss-120b"),
      schema: resultSchema,
      system: [
        "You are a navigation router for the Notra dashboard command palette.",
        "Given a natural language query, decide whether to navigate to an existing route or fall back to the AI chat.",
        "Only return `navigate` with a path that EXACTLY matches one of the provided paths.",
        "If no route confidently matches intent, return `chat` with path=null — the user will be handed off to an AI chat with their query.",
        "Keep `reason` under 120 characters, plain language, no quotes.",
      ].join(" "),
      prompt: [
        `Available routes (JSON): ${JSON.stringify(routes)}`,
        `User query: ${query}`,
      ].join("\n"),
      abortSignal: request.signal,
    });

    const normalizedPath = object.path ?? null;
    const validPath =
      normalizedPath !== null && routes.some((r) => r.path === normalizedPath);

    if (object.action === "navigate" && validPath) {
      return NextResponse.json({
        action: "navigate",
        path: normalizedPath,
        reason: object.reason,
      });
    }

    return NextResponse.json({
      action: "chat",
      path: null,
      reason: object.reason || "No confident route match.",
    });
  } catch (error) {
    log.set({
      feature: "command_palette",
      userId: user.id,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    log.emit();
    return NextResponse.json(
      { action: "chat", path: null, reason: "AI unavailable, opening chat." },
      { status: 200 }
    );
  }
}
