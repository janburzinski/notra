import { renderSkillToolOutput } from "@notra/ai/skills/functions/guidance";
import {
  createSkill as createSkillRecord,
  listSkillCatalog,
  loadSkillByName,
} from "@notra/ai/skills/functions/service";
import { toolDescription } from "@notra/ai/utils/description";
import { type Tool, tool } from "ai";
import z from "zod";

export interface SkillsToolContext {
  organizationId: string;
}

// Mirrors packages/schemas constants/skills. That package depends on
// @notra/ai, so it cannot be imported here without a package cycle.
const SKILL_NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const SKILL_NAME_MAX_LENGTH = 64;
const SKILL_DESCRIPTION_MAX_LENGTH = 1000;
const SKILL_CONTENT_MAX_LENGTH = 200_000;

export function listAvailableSkills(ctx: SkillsToolContext): Tool {
  return tool({
    description:
      "List available skills for this organization. Returns the permission-scoped skill catalog: name, description, and system status. Call getSkillByName to load a skill's full content before applying it.",
    inputSchema: z.object({
      limit: z.number().default(20).describe("The number of skills to list"),
      offset: z
        .number()
        .default(0)
        .describe("The offset to start listing skills from"),
    }),
    execute: async ({ limit, offset }) => {
      return listSkillCatalog(ctx, { limit, offset });
    },
  });
}

export function getSkillByName(ctx: SkillsToolContext): Tool {
  return tool({
    description:
      "Load a skill's full content by name. Returns a <skill_content> block containing the full skill body. Call listAvailableSkills first unless the exact skill name is already present in the prompt catalog.",
    inputSchema: z.object({
      name: z.string().describe("The name of the skill to load."),
    }),
    execute: async ({ name }) => {
      const skill = await loadSkillByName(ctx, name);

      if (!skill) {
        return {
          error: `Skill "${name}" not found. Use listAvailableSkills to see available skills.`,
        };
      }

      return {
        name: skill.name,
        description: skill.description,
        content: skill.content,
        skillContent: renderSkillToolOutput(skill),
      };
    },
  });
}

export function createCreateSkillTool(ctx: SkillsToolContext): Tool {
  return tool({
    description: toolDescription({
      toolName: "createSkill",
      intro:
        "Creates a new reusable writing skill (voice, format, structure guidance) for this organization.",
      whenToUse:
        "The user explicitly asks for a new skill, or a clearly new and recurring writing need appears that no existing skill covers.",
      whenNotToUse:
        "An existing skill already fits; reuse or edit that skill instead of creating a near-duplicate.",
      usageNotes:
        "Check listAvailableSkills for duplicates first. The name must be unique, lowercase kebab-case (letters, digits, hyphens only, max 64 chars). Provide a one-sentence description of when the skill applies plus the full skill body as content.",
    }),
    needsApproval: true,
    inputSchema: z.object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(SKILL_NAME_MAX_LENGTH)
        .regex(
          SKILL_NAME_REGEX,
          "Name must be lowercase, start and end with a letter or digit, and contain only letters, digits, and hyphens"
        )
        .describe("Unique skill name in lowercase kebab-case."),
      description: z
        .string()
        .trim()
        .min(1)
        .max(SKILL_DESCRIPTION_MAX_LENGTH)
        .describe("One-sentence description of when to apply this skill."),
      content: z
        .string()
        .min(1)
        .max(SKILL_CONTENT_MAX_LENGTH)
        .describe(
          "The full skill body: the reusable writing guidance applied when drafting content."
        ),
    }),
    execute: async ({ name, description, content }) => {
      const skill = await createSkillRecord(
        { organizationId: ctx.organizationId },
        { name, description, content }
      );

      return {
        name: skill.name,
        status: "created",
      };
    },
  });
}
