import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { autopilotMemoryMetadataSchema } from "../src/schemas/autopilot-memory";

if (process.env.NOTRA_MEMORY_TEST !== "1") {
  test("Autopilot Supermemory contract, tenant isolation and failures", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_MEMORY_TEST: "1",
          SUPERMEMORY_API_KEY: "test-only",
        },
        timeout: 30000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  });
} else {
  mock.module("@/lib/autopilot/llm", () => ({
    generateAutopilotObject: () => {
      throw new Error("No AI calls expected");
    },
  }));
  const { listRules, addRule, deleteRule, loadDecisionMemory } =
    await import("../src/lib/autopilot/rules");
  const { rememberFeedback, deleteAutopilotNamespace } =
    await import("../src/lib/autopilot/memory");
  const originalFetch = globalThis.fetch;
  const documents = new Map<
    string,
    {
      id: string;
      metadata: ReturnType<typeof autopilotMemoryMetadataSchema.parse>;
    }[]
  >();
  const calls: {
    url: string;
    method: string;
    body: Record<string, unknown>;
  }[] = [];
  let failed = false;
  let partialDelete = false;
  let staleSearch = false;
  let failedWrite = false;
  globalThis.fetch = mock(async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url: url.pathname, method: init?.method ?? "GET", body });
    if (failed) {
      return Response.json({ error: "unavailable" }, { status: 503 });
    }
    const [, , namespace, resource] = url.pathname.split("/");
    if (!namespace) {
      throw new Error("Missing namespace");
    }
    const rows = documents.get(namespace) ?? [];
    if (init?.method === "DELETE" && !resource) {
      if (!documents.has(namespace)) {
        return Response.json({ error: "missing" }, { status: 404 });
      }
      documents.delete(namespace);
      return Response.json({ status: "deleted", namespace });
    }
    if (init?.method === "GET") {
      expect(init.body).toBeUndefined();
      const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      const document = rows.find((row) => row.id === id);
      return document
        ? Response.json(document)
        : Response.json({ error: "missing" }, { status: 404 });
    }
    if (resource === "list") {
      const category = body.filter.operands[1].value;
      const filtered = rows.filter((row) => row.metadata.category === category);
      const page = Number(url.searchParams.get("page") ?? "1");
      return Response.json({
        documents: filtered.slice(page - 1, page),
        pagination: { currentPage: page, totalPages: filtered.length || 1 },
      });
    }
    if (resource === "search") {
      return Response.json({
        results: rows
          .filter((row) => row.metadata.category === "feedback")
          .map((row) => ({
            included: {
              document: { id: staleSearch ? "deleted-source" : row.id },
            },
          })),
      });
    }
    if (init?.method === "DELETE") {
      if (partialDelete) {
        return Response.json({ count: 0, errors: [{ id: body.ids[0] }] });
      }
      documents.set(
        namespace,
        rows.filter((row) => !body.ids.includes(row.id))
      );
      return Response.json({ count: 1, errors: [] });
    }
    const id =
      body.id ?? decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    const metadata = autopilotMemoryMetadataSchema.parse(body.metadata);
    if (init?.method === "PATCH" && !rows.some((row) => row.id === id)) {
      return Response.json({ error: "missing" }, { status: 404 });
    }
    documents.set(namespace, [
      ...rows.filter((row) => row.id !== id),
      { id, metadata },
    ]);
    return Response.json({ id, status: failedWrite ? "failed" : "done" });
  }) as typeof fetch;
  beforeEach(() => {
    documents.clear();
    calls.length = 0;
    failed = false;
    partialDelete = false;
    staleSearch = false;
    failedWrite = false;
  });
  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  test("rules use only namespace documents, deduplicate, and disappear after removal", async () => {
    const saved = await addRule({
      organizationId: "org-a",
      text: "Never suggest refactors",
      source: "dashboard",
    });
    expect(saved.status).toBe("added");
    expect(
      (
        await addRule({
          organizationId: "org-a",
          text: "never suggest refactors",
          source: "github",
        })
      ).status
    ).toBe("duplicate");
    expect(await listRules("org-b")).toEqual([]);
    const [rule] = await listRules("org-a");
    if (!rule) {
      throw new Error("Missing rule");
    }
    await deleteRule("org-b", rule.id);
    expect(await listRules("org-a")).toHaveLength(1);
    await deleteRule("org-a", rule.id);
    expect((await loadDecisionMemory("org-a", "refactors")).rules).toEqual([]);
    expect(calls.every((call) => call.url.startsWith("/ns/"))).toBe(true);
  });

  test("replayed and corrected feedback replaces one canonical document", async () => {
    const params = {
      organizationId: "org-a",
      id: "feedback-1",
      sourceUrl: "https://github.com/example/repo/pull/1",
      createdBy: "member",
    };
    await rememberFeedback({
      ...params,
      text: "Too technical for this audience",
    });
    await rememberFeedback({
      ...params,
      text: "Correction: keep the technical detail",
    });
    const memory = await loadDecisionMemory("org-a", "technical detail");
    expect(memory.feedback).toEqual(["Correction: keep the technical detail"]);
    expect(memory.rules).toEqual([]);
    expect(documents.get("org-a")).toHaveLength(1);
    expect(calls.some((call) => call.method === "PATCH")).toBe(true);
    expect(
      (await loadDecisionMemory("org-b", "technical detail")).feedback
    ).toEqual([]);
  });

  test("outages never turn hard rules into an empty successful load", async () => {
    failed = true;
    await expect(loadDecisionMemory("org-a", "anything")).rejects.toThrow();
    await expect(
      addRule({ organizationId: "org-a", text: "Never X", source: "dashboard" })
    ).rejects.toThrow();
  });

  test("partial deletion is an error, not a successful forgotten rule", async () => {
    await addRule({
      organizationId: "org-a",
      text: "Never X",
      source: "dashboard",
    });
    const [rule] = await listRules("org-a");
    if (!rule) {
      throw new Error("Missing rule");
    }
    partialDelete = true;
    await expect(deleteRule("org-a", rule.id)).rejects.toThrow();
    expect(await listRules("org-a")).toHaveLength(1);
  });

  test("all rule pages are loaded independently of semantic search", async () => {
    await addRule({
      organizationId: "org-a",
      text: "Never X",
      source: "dashboard",
    });
    await addRule({
      organizationId: "org-a",
      text: "Always Y",
      source: "dashboard",
    });
    staleSearch = true;
    expect((await loadDecisionMemory("org-a", "irrelevant")).rules).toEqual([
      "Never X",
      "Always Y",
    ]);
  });

  test("deleted or stale search sources are not recalled and failed processing is not acknowledged", async () => {
    const input = {
      organizationId: "org-a",
      id: "feedback-1",
      text: "More like this",
      sourceUrl: null,
      createdBy: "member",
    };
    await rememberFeedback(input);
    staleSearch = true;
    expect((await loadDecisionMemory("org-a", "anything")).feedback).toEqual(
      []
    );
    failedWrite = true;
    await expect(rememberFeedback(input)).rejects.toThrow();
  });

  test("decisions fetch only current search matches, never the feedback history", async () => {
    await rememberFeedback({
      organizationId: "org-a",
      id: "matched-feedback",
      text: "Current preference",
      sourceUrl: null,
      createdBy: "member",
    });
    calls.length = 0;
    expect((await loadDecisionMemory("org-a", "preference")).feedback).toEqual([
      "Current preference",
    ]);
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(1);
    expect(
      calls.some(
        (call) =>
          call.url.includes("/list/") &&
          JSON.stringify(call.body).includes('"feedback"')
      )
    ).toBe(false);
  });

  test("workspace cleanup deletes only its namespace, retries missing namespaces, and fails closed on outages", async () => {
    for (const organizationId of ["org-a", "org-b"]) {
      await addRule({ organizationId, text: "Never X", source: "dashboard" });
    }
    await deleteAutopilotNamespace("org-a");
    await deleteAutopilotNamespace("org-a");
    expect(documents.has("org-a")).toBe(false);
    expect(await listRules("org-b")).toHaveLength(1);
    failed = true;
    await expect(deleteAutopilotNamespace("org-b")).rejects.toThrow();
    expect(documents.has("org-b")).toBe(true);
  });

  test("missing cleanup credentials cannot silently acknowledge deleted namespace data", async () => {
    const key = process.env.SUPERMEMORY_API_KEY;
    delete process.env.SUPERMEMORY_API_KEY;
    try {
      await expect(deleteAutopilotNamespace("org-a")).rejects.toThrow(
        "SUPERMEMORY_API_KEY"
      );
    } finally {
      process.env.SUPERMEMORY_API_KEY = key;
    }
  });
}
