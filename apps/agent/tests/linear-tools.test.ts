import { beforeEach, describe, expect, mock, test } from "bun:test";

import { LinearError, LinearErrorType } from "@linear/sdk";

let resolveContext = mock(async () => ({
  accessToken: "token",
  linearTeamId: "team-1" as string | null,
}));
mock.module("@notra/ai/integrations/linear", () => ({
  getLinearToolContextByIntegrationId: (...args: unknown[]) =>
    resolveContext(...(args as [])),
}));

const oldCycle = {
  id: "cycle-old",
  name: null,
  number: 1,
  startsAt: new Date("2026-10-01T00:00:00.000Z"),
  endsAt: new Date("2026-10-15T00:00:00.000Z"),
  progress: 1,
  completedAt: new Date("2026-10-15T00:00:00.000Z"),
};
const activeCycle = {
  id: "cycle-active",
  name: "Cycle 2",
  number: 2,
  startsAt: new Date("2026-11-01T00:00:00.000Z"),
  endsAt: new Date("2026-11-15T00:00:00.000Z"),
  progress: 0.4,
  completedAt: undefined,
};
// The active cycle sits on the second page, so it is only found by paging.
const cycles = mock(async (_variables: unknown) => {
  const connection = {
    nodes: [oldCycle] as (typeof oldCycle | typeof activeCycle)[],
    pageInfo: { hasNextPage: true },
    fetchNext: async () => {
      connection.nodes.push(activeCycle);
      connection.pageInfo.hasNextPage = false;
      return connection;
    },
  };
  return connection;
});
const projects = mock(async () => ({
  nodes: [
    {
      id: "project-1",
      name: "Launch",
      description: null,
      state: "started",
      progress: 0.5,
      startDate: "2026-10-01",
      targetDate: null,
      lead: Promise.resolve({ name: "Ada" }),
      url: "https://linear.app/acme/project/launch",
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-11-02T00:00:00.000Z"),
    },
  ],
}));
const request = mock(async () => ({
  issues: {
    nodes: [
      {
        id: "issue-1",
        identifier: "ACME-1",
        title: "Fix login",
        description: null,
        state: { name: "Done", type: "completed" },
        priority: 2,
        priorityLabel: "High",
        assignee: null,
        labels: { nodes: [] },
        createdAt: "2026-10-30T09:00:00.000Z",
        updatedAt: "2026-11-02T09:00:00.000Z",
        completedAt: "2026-11-02T09:00:00.000Z",
        url: "https://linear.app/acme/issue/ACME-1",
      },
    ],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
}));

const realLinear = await import("@notra/ai/utils/linear");
mock.module("@notra/ai/utils/linear", () => ({
  ...realLinear,
  createLinearClient: () => ({
    client: { request },
    projects: () => projects(),
    team: async () => ({ cycles }),
  }),
}));

const { createGetLinearIssuesTool } =
  await import("@notra/tools/assistant/get-linear-issues");
const { createGetLinearProjectsTool } =
  await import("@notra/tools/assistant/get-linear-projects");
const { createGetLinearCyclesTool } =
  await import("@notra/tools/assistant/get-linear-cycles");

type Executable = {
  execute: (input: unknown, context: unknown) => Promise<unknown>;
};

const ctx = {
  session: {
    auth: {
      current: { attributes: { organizationId: "org-1" } },
      initiator: null,
    },
  },
};
const input = { integrationId: "linear-1", includeCompleted: true };

beforeEach(() => {
  resolveContext = mock(async () => ({
    accessToken: "token",
    linearTeamId: "team-1" as string | null,
  }));
});

describe("Linear tools return plain JSON", () => {
  test("get_linear_issues keeps timestamps as ISO strings", async () => {
    const tool = createGetLinearIssuesTool() as unknown as Executable;
    const result = await tool.execute(input, ctx);

    expect(result).toMatchObject({
      issues: [
        {
          createdAt: "2026-10-30T09:00:00.000Z",
          updatedAt: "2026-11-02T09:00:00.000Z",
          completedAt: "2026-11-02T09:00:00.000Z",
        },
      ],
    });
  });

  test("get_linear_projects converts SDK dates", async () => {
    const tool = createGetLinearProjectsTool() as unknown as Executable;
    const result = await tool.execute(input, ctx);

    expect(result).toMatchObject({
      projects: [
        {
          lead: "Ada",
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-11-02T00:00:00.000Z",
        },
      ],
    });
  });

  test("get_linear_cycles returns recent cycles newest first", async () => {
    const tool = createGetLinearCyclesTool() as unknown as Executable;
    const result = await tool.execute(input, ctx);

    expect(cycles.mock.calls[0]?.[0]).not.toHaveProperty("orderBy");
    expect(result).toEqual({
      cycles: [
        {
          id: "cycle-active",
          name: "Cycle 2",
          number: 2,
          startsAt: "2026-11-01T00:00:00.000Z",
          endsAt: "2026-11-15T00:00:00.000Z",
          progress: 0.4,
          completedAt: null,
        },
        {
          id: "cycle-old",
          name: null,
          number: 1,
          startsAt: "2026-10-01T00:00:00.000Z",
          endsAt: "2026-10-15T00:00:00.000Z",
          progress: 1,
          completedAt: "2026-10-15T00:00:00.000Z",
        },
      ],
    });
  });
});

describe("Linear tool failures", () => {
  test("an expired Linear token asks the user to reconnect", async () => {
    projects.mockImplementationOnce(() =>
      Promise.reject(
        new LinearError(undefined, [], LinearErrorType.AuthenticationError)
      )
    );
    const tool = createGetLinearProjectsTool() as unknown as Executable;

    expect(await tool.execute(input, ctx)).toBe(
      "Linear rejected Notra's access. Tell the user to reconnect Linear in Notra's integration settings."
    );
  });

  test("other failures return the cause instead of throwing", async () => {
    resolveContext = mock(() =>
      Promise.reject(
        new Error(
          "Linear integration access denied for integrationId linear-1. Integration is disabled."
        )
      )
    );
    const tool = createGetLinearIssuesTool() as unknown as Executable;

    expect(await tool.execute(input, ctx)).toBe(
      "Couldn't load data from Linear. Linear integration access denied for integrationId linear-1. Integration is disabled."
    );
  });
});
