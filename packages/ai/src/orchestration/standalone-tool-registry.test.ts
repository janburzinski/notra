import { describe, expect, test } from "bun:test";

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
