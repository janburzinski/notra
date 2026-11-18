import { GEO_TOOL_TABLE_NOTE } from "@notra/ai/constants/geo-tools";
import {
  findGeoPromptsInputSchema,
  getGeoCompetitorShareInputSchema,
  getGeoOverviewInputSchema,
  getGeoProjectContextInputSchema,
  getGeoPromptResultsInputSchema,
  getGeoScanInputSchema,
  getGeoTimeseriesInputSchema,
  listGeoProjectsInputSchema,
  scanGeoPromptInputSchema,
  createGeoProductInputSchema,
  deleteGeoProductInputSchema,
  moveGeoPromptsInputSchema,
  updateGeoProductInputSchema,
} from "@notra/ai/schemas/geo-tools";
import type {
  GeoProductCreator,
  GeoProductDeleter,
  GeoProductUpdater,
  GeoPromptMover,
} from "@notra/ai/types/geo-products";
import type {
  GeoPromptFinder,
  GeoPromptScanStarter,
} from "@notra/ai/types/geo-prompt-scan";
import type { OrganizationToolConfig } from "@notra/ai/types/organization";
import { toolDescription } from "@notra/ai/utils/description";
import {
  loadGeoCompetitorShareForTool,
  loadGeoOverviewForTool,
  loadGeoProjectContextForTool,
  loadGeoProjectsForTool,
  loadGeoPromptResultsForTool,
  loadGeoScanForTool,
  loadGeoTimeseriesForTool,
} from "@notra/ai/utils/geo-tool-data";
import { geoToolModelOutput } from "@notra/ai/utils/geo-tool-model-output";
import { type Tool, tool } from "ai";

export function createListGeoProjectsTool(
  config: OrganizationToolConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "listGeoProjects",
      intro:
        "Lists the organization's GEO projects with their names, company names, tracking status, and latest scan time.",
      whenToUse:
        "Use before a project-specific GEO tool when the user has not clearly identified a project, or when they ask what GEO projects exist.",
      usageNotes:
        "Use the returned project ID with getGeoProjectContext or to scope GEO analytics tools. Never guess a project ID.",
    }),
    inputSchema: listGeoProjectsInputSchema,
    execute: () => loadGeoProjectsForTool(config.organizationId),
  });
}

export function createGetGeoOverviewTool(config: OrganizationToolConfig): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoOverview",
      intro:
        "Gets the organization's GEO (AI visibility) status: how often AI engines like ChatGPT, Claude, and Gemini mention the company, per-engine mention rates and average positions, and which competitors the engines recommend instead.",
      whenToUse:
        "Use when the user asks about GEO performance, AI visibility, brand mentions in AI answers, engine performance, or competing brands in AI search.",
      usageNotes: `Choose a trailing window from 1 to 365 days. Omit projectId for all projects, or use an ID from listGeoProjects. mention_rate and visibility_rate are fractions from 0 to 1; multiply by 100 when displaying percentages. Data may be empty if no scans have run yet. Returns numbers only; to show a chart, call showGeoChart. ${GEO_TOOL_TABLE_NOTE}`,
    }),
    inputSchema: getGeoOverviewInputSchema,
    execute: ({ projectId, days }) =>
      loadGeoOverviewForTool(config.organizationId, projectId, days),
    toModelOutput: ({ output }) => geoToolModelOutput(output),
  });
}

export function createGetGeoTimeseriesTool(
  config: OrganizationToolConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoTimeseries",
      intro:
        "Returns daily GEO performance per AI engine, including checks, mentions, mention rate, and average position.",
      whenToUse:
        "Use when the user asks whether AI visibility is improving or declining, requests a trend, or wants to compare engine performance over time.",
      usageNotes: `Choose a trailing window from 1 to 365 days. Omit projectId for all projects, or use an ID from listGeoProjects. mention_rate and visibility_rate are fractions from 0 to 1; multiply by 100 when displaying percentages. Returns numbers only; to show a chart, call showGeoChart. ${GEO_TOOL_TABLE_NOTE}`,
    }),
    inputSchema: getGeoTimeseriesInputSchema,
    execute: ({ projectId, days }) =>
      loadGeoTimeseriesForTool(config.organizationId, projectId, days),
    toModelOutput: ({ output }) => geoToolModelOutput(output),
  });
}

export function createGetGeoPromptResultsTool(
  config: OrganizationToolConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoPromptResults",
      intro:
        "Returns the latest GEO result for each tracked prompt and AI engine, including whether the brand was mentioned, its position, sentiment, and an answer excerpt.",
      whenToUse:
        "Use when the user asks which prompts the brand wins or loses, what an AI engine answered, where the brand ranks, or which questions need content improvements.",
      usageNotes:
        "Use includeAnswers=true only when full answers are necessary. Omit projectId for all projects, or use an ID from listGeoProjects.",
    }),
    inputSchema: getGeoPromptResultsInputSchema,
    execute: ({ projectId, days, limit, includeAnswers }) =>
      loadGeoPromptResultsForTool(
        config.organizationId,
        projectId,
        days,
        limit,
        includeAnswers
      ),
  });
}

export function createGetGeoCompetitorShareTool(
  config: OrganizationToolConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoCompetitorShare",
      intro:
        "Ranks competitor brands by how often AI engines mentioned them in tracked GEO answers.",
      whenToUse:
        "Use when the user asks which competitors dominate AI answers, who is recommended instead of the brand, or which competitor deserves closer analysis.",
      usageNotes: `Choose a trailing window and result limit. Omit projectId for all projects, or use an ID from listGeoProjects. Returns numbers only; to show a chart, call showGeoChart. ${GEO_TOOL_TABLE_NOTE}`,
    }),
    inputSchema: getGeoCompetitorShareInputSchema,
    execute: ({ projectId, days, limit }) =>
      loadGeoCompetitorShareForTool(
        config.organizationId,
        projectId,
        days,
        limit
      ),
    toModelOutput: ({ output }) => geoToolModelOutput(output),
  });
}

export function createGetGeoProjectContextTool(
  config: OrganizationToolConfig
): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoProjectContext",
      intro:
        "Returns one GEO project's brand name and aliases, its most relevant tracked competitors (the ones AI engines recommend most) with the total tracked count, tracked prompts, and latest per-engine checks.",
      whenToUse:
        "Use for a detailed project-level picture before giving GEO positioning, competitor, prompt, or content recommendations.",
      usageNotes:
        "Call listGeoProjects first and pass an exact project ID. Use includeAnswers=true only when full answers are necessary. When trackedCompetitorCount is larger than the competitors returned, pass competitorSearch to look up a specific one.",
    }),
    inputSchema: getGeoProjectContextInputSchema,
    execute: ({ projectId, includeAnswers, competitorSearch }) =>
      loadGeoProjectContextForTool(
        config.organizationId,
        projectId,
        includeAnswers,
        competitorSearch
      ),
  });
}

export function createScanGeoPromptTool(
  config: OrganizationToolConfig & { startGeoPromptScan: GeoPromptScanStarter }
): Tool {
  return tool({
    description: toolDescription({
      toolName: "scanGeoPrompt",
      intro:
        "Asks AI engines one tracked GEO prompt again now, on every engine the project tracks or only the engines listed (one is fine).",
      whenToUse:
        "Use when the user wants fresh answers for a prompt, for example to check whether ChatGPT mentions the brand today or after publishing content for it.",
      usageNotes:
        "The user approves each call, so first find the exact prompt with findGeoPrompts and pass its id; when the request fits several prompts, ask which one before calling. It uses the workspace's AI answers like a rescan in GEO. Returns status started with a scanId; read it with getGeoScan after a minute or two (consumer apps such as ChatGPT can take several minutes). status choose or not_found lists prompts to pick from: ask the user which one, never guess. status error carries the reason, including the engine ids this project can scan when one was unknown.",
    }),
    inputSchema: scanGeoPromptInputSchema,
    execute: ({ projectId, prompt, engines }) =>
      config.startGeoPromptScan({
        organizationId: config.organizationId,
        projectId,
        prompt,
        engines,
      }),
  });
}

export function createGetGeoScanTool(config: OrganizationToolConfig): Tool {
  return tool({
    description: toolDescription({
      toolName: "getGeoScan",
      intro:
        "Reads a GEO scan by scanId: status (running, completed or failed), the engines it asked and each answer stored so far with mention, rank, competitors and an excerpt.",
      whenToUse:
        "Use after scanGeoPrompt started a scan, to report what the engines answered.",
      usageNotes:
        "While status is running, answers may still be missing; say so instead of reporting them as not mentioned. When has_more is true, call again with offset set to next_offset.",
    }),
    inputSchema: getGeoScanInputSchema,
    execute: async ({ scanId, offset }) =>
      (await loadGeoScanForTool(config.organizationId, scanId, offset)) ?? {
        found: false,
        message: "No scan with that id exists in this workspace.",
      },
  });
}

export function createFindGeoPromptsTool(
  config: OrganizationToolConfig & { findGeoPrompts: GeoPromptFinder }
): Tool {
  return tool({
    description: toolDescription({
      toolName: "findGeoPrompts",
      intro:
        "Finds the project's enabled tracked GEO prompts, auto-generated and custom, that match a few words, with their ids.",
      whenToUse:
        "Use before scanGeoPrompt to name the exact prompt, or when the user asks which prompts are tracked.",
      usageNotes:
        "Returns up to 20 prompts and the total that matched. When more than one fits the request, ask the user which one.",
    }),
    inputSchema: findGeoPromptsInputSchema,
    execute: ({ projectId, query }) =>
      config.findGeoPrompts({
        organizationId: config.organizationId,
        projectId,
        query,
      }),
  });
}

export function createCreateGeoProductTool(
  config: OrganizationToolConfig & { createGeoProduct: GeoProductCreator }
): Tool {
  return tool({
    description: toolDescription({
      toolName: "createGeoProduct",
      intro:
        "Adds a product to a GEO project. Tracked prompts without a product that fit it are filed into it right away, and prompts added later are filed automatically too.",
      whenToUse:
        "Use when the user asks to add a product, or names a product or product line the company sells that the project doesn't have yet.",
      usageNotes:
        "Name it the way the company's site does, never a customer segment, plan tier or single feature. Returns status created with sortedPrompts, the number of prompts it picked up, or status exists with the product that already has the name. To move specific prompts into it, call moveGeoPrompts next.",
    }),
    inputSchema: createGeoProductInputSchema,
    execute: ({ projectId, name, niche }) =>
      config.createGeoProduct({
        organizationId: config.organizationId,
        projectId,
        name,
        niche,
      }),
  });
}

export function createMoveGeoPromptsTool(
  config: OrganizationToolConfig & { moveGeoPrompts: GeoPromptMover }
): Tool {
  return tool({
    description: toolDescription({
      toolName: "moveGeoPrompts",
      intro:
        "Moves tracked custom GEO prompts into one of the project's products, or out of their product with product null.",
      whenToUse:
        "Use when the user wants prompts filed under a different product, or after createGeoProduct to file the prompts they named.",
      usageNotes:
        "Find the prompts with findGeoPrompts first and pass their ids. Auto prompts from the brand settings can't belong to a product. unmatched lists prompts that weren't moved and why; when one lists choices, ask the user which one. An unknown product name returns the project's products. Moving prompts does not change how new prompts are filed.",
    }),
    inputSchema: moveGeoPromptsInputSchema,
    execute: ({ projectId, prompts, product }) =>
      config.moveGeoPrompts({
        organizationId: config.organizationId,
        projectId,
        prompts,
        product,
      }),
  });
}

export function createUpdateGeoProductTool(
  config: OrganizationToolConfig & { updateGeoProduct: GeoProductUpdater }
): Tool {
  return tool({
    description: toolDescription({
      toolName: "updateGeoProduct",
      intro:
        "Renames one of the project's GEO products or changes who it is for. Its prompts stay with it.",
      whenToUse:
        "Use when the user asks to rename a product or describe it differently.",
      usageNotes:
        "Pass the product's current name. An unknown name returns the project's products.",
    }),
    inputSchema: updateGeoProductInputSchema,
    execute: ({ projectId, product, name, niche }) =>
      config.updateGeoProduct({
        organizationId: config.organizationId,
        projectId,
        product,
        name,
        niche,
      }),
  });
}

export function createDeleteGeoProductTool(
  config: OrganizationToolConfig & { deleteGeoProduct: GeoProductDeleter }
): Tool {
  return tool({
    description: toolDescription({
      toolName: "deleteGeoProduct",
      intro:
        "Deletes one of the project's GEO products. Its prompts stay tracked and move into another product when one fits; the weekly website check never adds it back.",
      whenToUse: "Use only when the user asks to delete or remove a product.",
      usageNotes:
        "The user approves each call. Pass the product's name. Returns how many prompts lost the product and how many moved into another one.",
    }),
    inputSchema: deleteGeoProductInputSchema,
    execute: ({ projectId, product }) =>
      config.deleteGeoProduct({
        organizationId: config.organizationId,
        projectId,
        product,
      }),
  });
}
