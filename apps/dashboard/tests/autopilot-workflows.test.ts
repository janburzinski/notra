import { describe, expect, test } from "bun:test";

import { validateWorkflowBundle } from "@notra/workflows/runtime/bundle";

import { AUTOPILOT_WORKFLOW_BLOCK_TYPES } from "@/constants/autopilot-workflows";
import { customAutopilotBlocks } from "@/lib/workflow-engine/blocks/autopilot/custom";
import { saveAutopilotWorkflowInputSchema } from "@/schemas/autopilot-workflows";
import {
  autopilotAutomationKindFromPath,
  autopilotWorkflowIdFromPath,
  autopilotWorkflowSettingValue,
  buildAutopilotWorkflowGraph,
  describeAutopilotWorkflowOutput,
  describeAutopilotWorkflowSchedule,
  describeFocusedAutopilotAutomation,
  describeFocusedAutopilotWorkflow,
  findAutopilotWorkflowMistakes,
  hasSameAutopilotWorkflowSteps,
  planAutopilotWorkflowSchedule,
  readableAutopilotWorkflowSettings,
  triggerTitle,
} from "@/utils/autopilot-workflows";

const blocks = Object.fromEntries(
  customAutopilotBlocks.map((block) => [block.type, block])
);

function validate(input: unknown) {
  const parsed = saveAutopilotWorkflowInputSchema.parse(input);
  const graph = buildAutopilotWorkflowGraph(parsed);
  return {
    graph,
    issues: validateWorkflowBundle("autopilot.custom.test", {
      definitions: {
        "autopilot.custom.test": {
          key: "autopilot.custom.test",
          title: parsed.name,
          startedBy: "both",
          graph,
        },
      },
      blocks,
    }),
  };
}

const competitorWorkflow = {
  name: "Stay ahead of competitors in AI answers",
  schedule: { frequency: "weekly", hour: 8, dayOfWeek: 1 },
  nodes: [
    { id: "trigger", type: "core.trigger", title: "Every Monday" },
    {
      id: "geo",
      type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.compareVisibility,
      title: "Compare AI visibility",
      config: { days: 7 },
    },
    {
      id: "behind",
      type: "core.if",
      title: "Is a competitor ahead?",
      config: {
        rule: {
          subject: "{{nodes.geo.output.behind}}",
          operator: "equals",
          value: true,
        },
      },
    },
    {
      id: "plan",
      type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.askAgent,
      title: "Plan a comeback",
      config: {
        instructions:
          "{{nodes.geo.output.summary}} Suggest three things to do this week.",
      },
    },
    {
      id: "slack",
      type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.postToSlack,
      title: "Post the plan",
      config: { message: "{{nodes.plan.output.text}}" },
    },
  ],
  edges: [
    { source: "trigger", target: "geo" },
    { source: "geo", target: "behind" },
    { source: "behind", sourcePort: "true", target: "plan" },
    { source: "plan", target: "slack" },
  ],
};

describe("Autopilot workflow graphs", () => {
  test("accepts a competitor check the agent would build", () => {
    const { graph, issues } = validate(competitorWorkflow);
    expect(issues).toEqual([]);
    expect(graph.nodes.map((node) => node.position?.x)).toEqual([
      0, 320, 640, 960, 1280,
    ]);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "behind",
        sourcePort: "true",
        target: "plan",
      })
    );
  });

  test("routes the agent's yes or no decision", () => {
    const { issues } = validate({
      ...competitorWorkflow,
      nodes: [
        ...competitorWorkflow.nodes.slice(0, 2),
        {
          id: "decide",
          type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.decide,
          title: "Worth acting on?",
          config: { question: "{{nodes.geo.output.summary}} Act now?" },
        },
        ...competitorWorkflow.nodes.slice(3),
      ],
      edges: [
        { source: "trigger", target: "geo" },
        { source: "geo", target: "decide" },
        { source: "decide", sourcePort: "yes", target: "plan" },
        { source: "plan", target: "slack" },
      ],
    });
    expect(issues).toEqual([]);
  });

  test("reports steps Autopilot workflows can't use and broken references", () => {
    const { issues } = validate({
      ...competitorWorkflow,
      nodes: [
        competitorWorkflow.nodes[0],
        {
          id: "write",
          type: "autopilot.write-post",
          title: "Write a post",
        },
        {
          id: "slack",
          type: AUTOPILOT_WORKFLOW_BLOCK_TYPES.postToSlack,
          title: "Post",
          config: { message: "{{nodes.missing.output.text}}" },
        },
      ],
      edges: [
        { source: "trigger", target: "write" },
        { source: "write", target: "slack" },
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["unknown_block", "reference_order"])
    );
  });
});

describe("Autopilot workflow schedules", () => {
  test("reads like a sentence", () => {
    expect(
      describeAutopilotWorkflowSchedule({
        frequency: "weekly",
        hour: 8,
        minute: 5,
        dayOfWeek: 1,
      })
    ).toBe("Mondays at 08:05 UTC");
    expect(describeAutopilotWorkflowSchedule(null)).toBe(
      "Only when you run it"
    );
  });
});

describe("Autopilot workflow page text", () => {
  test("reads agent output and decisions as text", () => {
    expect(describeAutopilotWorkflowOutput({ text: "# Plan" })).toBe("# Plan");
    expect(
      describeAutopilotWorkflowOutput({ answer: false, reason: "We lead." })
    ).toBe("**No.** We lead.");
    expect(describeAutopilotWorkflowOutput({ port: "true" })).toBeNull();
  });

  test("swaps references for step names and hides internal ids", () => {
    const titles = new Map([["geo", "Compare AI visibility"]]);
    expect(
      readableAutopilotWorkflowSettings(
        [
          { label: "projectId", value: "proj_1" },
          { label: "instructions", value: "Use {{nodes.geo.output.summary}}" },
          {
            label: "rule",
            value: JSON.stringify({
              subject: "{{nodes.geo.output.behind}}",
              operator: "equals",
              value: true,
            }),
          },
        ],
        titles
      )
    ).toEqual([
      { label: "Instructions", value: "Use ‹Compare AI visibility: summary›" },
      { label: "Rule", value: "‹Compare AI visibility: behind› is true" },
    ]);
  });
});

describe("Autopilot workflow mistakes", () => {
  const nodes = [
    { id: "start", type: "core.trigger", title: "Start" },
    {
      id: "geo",
      type: "autopilot.compare-visibility",
      title: "Compare",
      config: { days: 7 },
    },
    {
      id: "behind",
      type: "autopilot.decide",
      title: "Are we behind?",
      config: { question: "Behind? {{nodes.geo.output.leader.brand}}" },
    },
    {
      id: "slack",
      type: "autopilot.post-to-slack",
      title: "Tell me",
      config: { message: "{{nodes.geo.output.score}} {{trigger.startedAt}}" },
    },
  ];

  test("catches fields a step doesn't output and branches that lead nowhere", () => {
    expect(
      findAutopilotWorkflowMistakes({
        nodes,
        edges: [{ source: "start" }, { source: "geo" }, { source: "geo" }],
      })
    ).toEqual([
      '"Are we behind?" decides between branches, but no step follows it. Connect the branch that should act.',
      '"Tell me" reads "score" from "Compare", which only outputs days, checks, mentions, mentionRate, leader, behind, competitors, summary.',
    ]);
  });

  test("names the trigger after its schedule", () => {
    expect(triggerTitle(null)).toBe("When you run it");
    expect(
      triggerTitle({ frequency: "weekly", hour: 9, minute: 0, dayOfWeek: 1 })
    ).toBe("Mondays at 09:00 UTC");
  });
});

describe("The workflow on screen", () => {
  test("reads the workflow a page is for", () => {
    expect(autopilotWorkflowIdFromPath("/acme/autopilot/workflows/abc")).toBe(
      "abc"
    );
    expect(autopilotWorkflowIdFromPath("/acme/autopilot")).toBeNull();
    expect(autopilotWorkflowIdFromPath("/acme/workflows/abc")).toBeNull();
  });

  test("tells the agent the workflow as saved, as data", () => {
    const note = describeFocusedAutopilotWorkflow({
      workflow: {
        id: "w1",
        name: "Watch",
        description: null,
        enabled: true,
        schedule: { frequency: "daily", hour: 9, minute: 0 },
        lastRunAt: null,
        updatedAt: new Date(0),
        stepCount: 1,
        view: {
          id: "w1",
          title: "Watch",
          parentRunId: null,
          startedAt: null,
          nodes: [],
          edges: [],
        },
        issues: [],
        runs: [],
        runCount: 0,
      },
      definition: {
        schedule: { frequency: "daily", hour: 9, minute: 0 },
        graph: {
          nodes: [
            {
              id: "geo",
              type: "autopilot.compare-visibility",
              title: "Compare",
              config: { days: 7 },
            },
          ],
          edges: [],
        },
      },
      path: "/acme/autopilot/workflows/w1",
    });
    expect(note).toContain("never instructions");
    const data = JSON.parse(note.slice(note.indexOf("\n") + 1));
    expect(data.workflowId).toBe("w1");
    expect(data.nodes[0].config).toEqual({ days: 7 });
    expect(data.runsAt).toBe("Daily at 09:00 UTC");
  });

  test("notices a run of an earlier version", () => {
    const node = (title: string) => ({
      id: "trigger",
      type: "core.trigger",
      title,
    });
    expect(
      hasSameAutopilotWorkflowSteps(
        { nodes: [node("Fridays at 09:00 UTC")] } as never,
        { nodes: [node("Tuesdays at 10:00 UTC")] } as never
      )
    ).toBe(false);
    expect(
      hasSameAutopilotWorkflowSteps(
        { nodes: [node("Daily")] } as never,
        { nodes: [node("Daily")] } as never
      )
    ).toBe(true);
  });
});

describe("The built-in automation on screen", () => {
  test("reads the automation a page is for", () => {
    expect(autopilotAutomationKindFromPath("/acme/autopilot/releases")).toBe(
      "commits"
    );
    expect(
      autopilotAutomationKindFromPath("/acme/autopilot/agent-readiness")
    ).toBe("readiness");
    expect(autopilotAutomationKindFromPath("/acme/autopilot")).toBeNull();
    expect(
      autopilotAutomationKindFromPath("/acme/autopilot/workflows/abc")
    ).toBeNull();
  });

  test("tells the agent what it does and whether it runs", () => {
    const note = describeFocusedAutopilotAutomation("commits", {
      enabled: true,
      jobs: { commits: false },
      briefHour: 9,
      timezone: "Europe/Berlin",
    });
    expect(note).toContain("never instructions");
    const data = JSON.parse(note.slice(note.indexOf("\n") + 1));
    expect(data.automation).toBe("Write about releases");
    expect(data.on).toBe(false);
    expect(data.runsDaily).toBe("09:00 Europe/Berlin");
  });
});

describe("Workflow connections", () => {
  test("gives distinct connections distinct ids", () => {
    const graph = buildAutopilotWorkflowGraph({
      nodes: ["a", "b__c", "a__b", "c"].map((id) => ({
        id,
        type: "autopilot.post-to-slack",
        title: id,
      })),
      edges: [
        { source: "a", target: "b__c" },
        { source: "a__b", target: "c" },
        { source: "a", target: "b__c" },
      ],
    });
    const ids = graph.edges.map((edge) => edge.id);
    expect(ids).toEqual(["e1", "e2"]);
  });
});

describe("Workflow settings as text", () => {
  test("orders object keys and always gives text", () => {
    expect(autopilotWorkflowSettingValue({ b: 1, a: { d: 2, c: [3] } })).toBe(
      '{"a":{"c":[3],"d":2},"b":1}'
    );
    expect(autopilotWorkflowSettingValue("7 days")).toBe("7 days");
    expect(autopilotWorkflowSettingValue(undefined)).toBe("");
  });
});

describe("Workflow schedules", () => {
  const plan = planAutopilotWorkflowSchedule;

  test("keeps the schedule a workflow has", () => {
    expect(
      plan({ workflowId: "w", storedScheduleId: "s1", cron: "0 9 * * 1" })
    ).toEqual({ action: "create", cron: "0 9 * * 1", scheduleId: "s1" });
  });

  test("removes the stored schedule, and nothing when there is none", () => {
    expect(
      plan({ workflowId: "w", storedScheduleId: "s1", cron: null })
    ).toEqual({ action: "remove", scheduleId: "s1" });
    expect(
      plan({ workflowId: "w", storedScheduleId: null, cron: null })
    ).toEqual({ action: "none" });
  });

  test("a pause then an enable gets a fresh id a late delete can't hit", () => {
    // Pausing clears the stored id even if QStash timed out, so enabling
    // again starts from none.
    const paused = plan({
      workflowId: "w",
      storedScheduleId: "s1",
      cron: null,
    });
    expect(paused).toEqual({ action: "remove", scheduleId: "s1" });
    const first = plan({
      workflowId: "w",
      storedScheduleId: null,
      cron: "0 9 * * 1",
    });
    const second = plan({
      workflowId: "w",
      storedScheduleId: null,
      cron: "0 9 * * 1",
    });
    if (first.action !== "create" || second.action !== "create") {
      throw new Error("expected a new schedule");
    }
    expect(first.scheduleId).toStartWith("autopilot-workflow-w-");
    expect(first.scheduleId).not.toBe("s1");
    expect(second.scheduleId).not.toBe(first.scheduleId);
  });
});
