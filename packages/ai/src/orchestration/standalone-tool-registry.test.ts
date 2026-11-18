import { describe, expect, test } from "bun:test";

import type {
  GeoProductCreator,
  GeoProductDeleter,
  GeoProductUpdater,
  GeoPromptMover,
} from "../types/geo-products";
import type {
  GeoPromptFinder,
  GeoPromptScanStarter,
} from "../types/geo-prompt-scan";
import {
  buildStandaloneToolSet,
  getStandaloneApprovalToolNames,
} from "./standalone-tool-registry";

process.env.UPSTASH_BOX_API_KEY ??= "test-box-key";

const params = {
  organizationId: "org_1",
  userId: "user_1",
  validatedIntegrations: [],
  postResult: {},
};

describe("prompt scans in the dashboard chat", () => {
  test("offers them only when the host can start a scan", () => {
    const { tools } = buildStandaloneToolSet(params);
    expect(tools.scanGeoPrompt).toBeUndefined();
    expect(tools.getGeoScan).toBeUndefined();
  });

  test("asks the user before a scan, but not to find a prompt or read a scan", () => {
    const approvals = getStandaloneApprovalToolNames();
    expect(approvals.has("scanGeoPrompt")).toBe(true);
    expect(approvals.has("findGeoPrompts")).toBe(false);
    expect(approvals.has("getGeoScan")).toBe(false);
  });

  test("hands the scan to the host for this workspace", async () => {
    const calls: unknown[] = [];
    const startGeoPromptScan: GeoPromptScanStarter = async (input) => {
      calls.push(input);
      return {
        status: "started",
        scanId: "scan_1",
        promptId: "p1",
        prompt: "Best issue tracker",
      };
    };
    const findGeoPrompts: GeoPromptFinder = async () => ({
      prompts: [{ id: "p1", prompt: "Best issue tracker" }],
      total: 1,
    });
    const { tools, descriptions } = buildStandaloneToolSet(params, {
      startGeoPromptScan,
      findGeoPrompts,
    });

    const result = await tools.scanGeoPrompt?.execute?.(
      { prompt: "issue tracker", engines: ["openai/chatgpt"] },
      { toolCallId: "call_1", messages: [], context: {} }
    );

    expect(result).toMatchObject({ status: "started", scanId: "scan_1" });
    expect(calls).toEqual([
      {
        organizationId: "org_1",
        projectId: undefined,
        prompt: "issue tracker",
        engines: ["openai/chatgpt"],
      },
    ]);
    expect(tools.getGeoScan).toBeDefined();
    expect(
      await tools.findGeoPrompts?.execute?.(
        { query: "issue tracker" },
        { toolCallId: "call_2", messages: [], context: {} }
      )
    ).toEqual({
      prompts: [{ id: "p1", prompt: "Best issue tracker" }],
      total: 1,
    });
    expect(descriptions.join("\n")).toContain("scanGeoPrompt");
  });
});

describe("products in the dashboard chat", () => {
  test("offers them only when the host can change products, without asking first", () => {
    expect(
      buildStandaloneToolSet(params).tools.createGeoProduct
    ).toBeUndefined();
    const approvals = getStandaloneApprovalToolNames();
    expect(approvals.has("createGeoProduct")).toBe(false);
    expect(approvals.has("moveGeoPrompts")).toBe(false);
    expect(approvals.has("updateGeoProduct")).toBe(false);
    expect(approvals.has("deleteGeoProduct")).toBe(true);
  });

  test("hands new products and moves to the host for this workspace", async () => {
    const calls: unknown[] = [];
    const createGeoProduct: GeoProductCreator = async (input) => {
      calls.push(input);
      return {
        status: "created",
        product: { id: "prod_1", name: "Team plan", niche: null },
        sortedPrompts: 2,
      };
    };
    const moveGeoPrompts: GeoPromptMover = async (input) => {
      calls.push(input);
      return {
        status: "moved",
        product: "Team plan",
        moved: [{ id: "p1", prompt: "Shared snippets for teams" }],
        unmatched: [],
      };
    };
    const { tools, descriptions } = buildStandaloneToolSet(params, {
      createGeoProduct,
      moveGeoPrompts,
    });

    expect(
      await tools.createGeoProduct?.execute?.(
        { name: "Team plan" },
        { toolCallId: "call_1", messages: [], context: {} }
      )
    ).toMatchObject({ status: "created", sortedPrompts: 2 });
    expect(
      await tools.moveGeoPrompts?.execute?.(
        { prompts: ["p1"], product: "Team plan" },
        { toolCallId: "call_2", messages: [], context: {} }
      )
    ).toMatchObject({ status: "moved", product: "Team plan" });
    expect(calls).toEqual([
      {
        organizationId: "org_1",
        projectId: undefined,
        name: "Team plan",
        niche: undefined,
      },
      {
        organizationId: "org_1",
        projectId: undefined,
        prompts: ["p1"],
        product: "Team plan",
      },
    ]);
    expect(descriptions.join("\n")).toContain("createGeoProduct");
  });
});

describe("renaming and deleting products in the dashboard chat", () => {
  test("hands the product name to the host, and only offers what the host supports", async () => {
    const calls: unknown[] = [];
    const base = {
      createGeoProduct: async () => ({
        status: "error" as const,
        error: "unused",
      }),
      moveGeoPrompts: async () => ({
        status: "error" as const,
        error: "unused",
      }),
    };
    const updateGeoProduct: GeoProductUpdater = async (input) => {
      calls.push(input);
      return {
        status: "updated",
        product: { id: "prod_1", name: "Raycast", niche: null },
      };
    };
    const deleteGeoProduct: GeoProductDeleter = async (input) => {
      calls.push(input);
      return {
        status: "deleted",
        product: "Notes",
        unfiledPrompts: 2,
        refiledPrompts: 1,
      };
    };

    expect(
      buildStandaloneToolSet(params, base).tools.deleteGeoProduct
    ).toBeUndefined();
    const { tools } = buildStandaloneToolSet(params, {
      ...base,
      updateGeoProduct,
      deleteGeoProduct,
    });
    await tools.updateGeoProduct?.execute?.(
      { product: "Launcher", name: "Raycast" },
      { toolCallId: "call_1", messages: [], context: {} }
    );
    expect(
      await tools.deleteGeoProduct?.execute?.(
        { product: "Notes" },
        { toolCallId: "call_2", messages: [], context: {} }
      )
    ).toMatchObject({ status: "deleted", refiledPrompts: 1 });
    expect(calls).toEqual([
      {
        organizationId: "org_1",
        projectId: undefined,
        product: "Launcher",
        name: "Raycast",
        niche: undefined,
      },
      { organizationId: "org_1", projectId: undefined, product: "Notes" },
    ]);
  });
});
