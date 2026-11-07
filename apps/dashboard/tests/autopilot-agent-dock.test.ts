import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import {
  findPendingAgentQuestion,
  findSettledAgentQuestion,
  formatAgentAnswers,
  readAgentAnswers,
  readAgentQuestions,
} from "@/utils/agent-questions";
import {
  describeAutopilotWorkflowChanges,
  findAutopilotWorkflowDraft,
} from "@/utils/autopilot-workflow-draft";
import { autopilotWorkflowSettingValue } from "@/utils/autopilot-workflows";
import { getChatActivity } from "@/utils/chat-activity";
import { findContinuableDenial } from "@/utils/chat-approvals";
import { handleStandaloneChatError } from "@/utils/chat-error";
import {
  getAssistantActivityStep,
  getAssistantActivityWaitingStep,
} from "@/utils/group-assistant-message-parts";

const input = {
  questions: [
    {
      question: "Which competitor should I watch?",
      header: "Competitor",
      options: [{ label: "Acme" }, { label: "Globex", description: "Biggest" }],
    },
    {
      question: "Where should alerts go?",
      header: "Alerts",
      options: [{ label: "Slack" }, { label: "Email" }],
      multiple: true,
    },
  ],
};

function assistant(parts: unknown[]): UIMessage {
  return { id: "a1", role: "assistant", parts } as UIMessage;
}

function questionPart(state: string, extra: Record<string, unknown> = {}) {
  return {
    type: "tool-askUserQuestion",
    toolCallId: "q1",
    state,
    input,
    ...extra,
  };
}

describe("Agent questions", () => {
  test("finds the questions the agent is waiting on", () => {
    const messages = [
      assistant([{ type: "step-start" }, questionPart("input-available")]),
    ];
    expect(findPendingAgentQuestion(messages)?.toolCallId).toBe("q1");
    expect(findPendingAgentQuestion(messages)?.questions[1]?.multiple).toBe(
      true
    );
    expect(findSettledAgentQuestion(messages)).toBeNull();
  });

  test("sends the conversation back once answered or dismissed, and only then", () => {
    for (const settled of [
      questionPart("output-available", {
        output: { answers: [["Acme"], ["Slack", "Email"]] },
      }),
      questionPart("output-error", { errorText: "dismissed" }),
    ]) {
      const answered = assistant([{ type: "step-start" }, settled]);
      expect(findSettledAgentQuestion([answered])).toBe("q1");
      const continued = assistant([
        ...answered.parts,
        { type: "step-start" },
        { type: "text", text: "Building it now." },
      ]);
      expect(findSettledAgentQuestion([continued])).toBeNull();
      expect(findPendingAgentQuestion([continued])).toBeNull();
    }
  });

  test("reads questions while they stream in", () => {
    expect(readAgentQuestions({ questions: [{ question: "" }] })).toEqual([]);
    expect(
      readAgentQuestions({
        questions: [{ question: "Which?", options: [{ label: "A" }, {}] }],
      })
    ).toEqual([
      {
        question: "Which?",
        header: "",
        options: [{ label: "A", description: undefined }],
        multiple: false,
      },
    ]);
    expect(readAgentAnswers({ answers: [["A"], [1, "B"]] })).toEqual([
      ["A"],
      ["B"],
    ]);
  });

  test("tells the model what was answered, like OpenCode does", () => {
    expect(formatAgentAnswers(input.questions, [["Acme"], []])).toBe(
      'User has answered your questions: "Which competitor should I watch?"="Acme", "Where should alerts go?"="Unanswered". You can now continue with the user\'s answers in mind.'
    );
  });
});

describe("Live workflow preview", () => {
  test("shows only the steps and connections that streamed in", () => {
    const draft = findAutopilotWorkflowDraft([
      assistant([
        {
          type: "tool-saveAutopilotWorkflow",
          toolCallId: "s1",
          state: "input-streaming",
          input: {
            name: "Competitor watch",
            schedule: { frequency: "weekly", hour: 9, minute: 0, dayOfWeek: 1 },
            nodes: [
              { id: "start", type: "core.trigger", title: "Every Monday" },
              {
                id: "behind",
                type: "autopilot.decide",
                title: "Are we behind?",
                config: { question: "Behind?" },
              },
              { id: "half", type: "autopilot.ask-agent" },
            ],
            edges: [
              { source: "start", target: "behind" },
              { source: "behind", sourcePort: "yes", target: "half" },
            ],
          },
        },
      ]),
    ]);
    expect(draft?.status).toBe("drafting");
    expect(draft?.name).toBe("Competitor watch");
    expect(draft?.schedule?.dayOfWeek).toBe(1);
    expect(draft?.view.nodes.map((node) => node.id)).toEqual([
      "start",
      "behind",
    ]);
    expect(draft?.view.edges).toHaveLength(1);
    expect(draft?.view.nodes[1]?.settings).toEqual([
      { label: "question", value: "Behind?" },
    ]);
  });

  test("lays steps out in a row until their connections stream in", () => {
    const streaming = findAutopilotWorkflowDraft([
      assistant([
        {
          type: "tool-saveAutopilotWorkflow",
          toolCallId: "s1",
          state: "input-streaming",
          input: {
            nodes: [
              { id: "start", type: "core.trigger", title: "Start" },
              {
                id: "geo",
                type: "autopilot.compare-visibility",
                title: "Compare",
              },
              { id: "sla", type: "autopilot.post-to-slack", title: "Tel" },
            ],
          },
        },
      ]),
    ]);
    // The last step may still be streaming, so it waits.
    expect(streaming?.view.nodes.map((node) => node.id)).toEqual([
      "start",
      "geo",
    ]);
    expect(streaming?.view.nodes.map((node) => node.position?.y)).toEqual([
      0, 0,
    ]);
    expect(streaming?.view.nodes[1]?.position?.x).toBeGreaterThan(0);
    expect(streaming?.view.nodes[0]?.kind).toBe("trigger");

    const written = findAutopilotWorkflowDraft([
      assistant([
        {
          type: "tool-saveAutopilotWorkflow",
          toolCallId: "s1",
          state: "input-available",
          input: {
            nodes: [
              { id: "start", type: "core.trigger", title: "Start" },
              { id: "slack", type: "autopilot.post-to-slack", title: "Tell" },
              { id: "slack", type: "autopilot.post-to-slack", title: "Again" },
            ],
            edges: [],
          },
        },
      ]),
    ]);
    expect(written?.view.nodes.map((node) => node.id)).toEqual([
      "start",
      "slack",
    ]);
    expect(written?.view.nodes[1]?.logo).toBe("slack");
  });

  test("waits for the user's approval before saving", () => {
    const draft = findAutopilotWorkflowDraft([
      assistant([
        {
          type: "tool-saveAutopilotWorkflow",
          toolCallId: "s1",
          state: "approval-requested",
          approval: { id: "a1" },
          input: { name: "Watch", nodes: [] },
        },
      ]),
    ]);
    expect(draft?.status).toBe("awaiting-approval");
    expect(draft?.approvalId).toBe("a1");
  });

  test("links the saved workflow and reports issues", () => {
    const saved = findAutopilotWorkflowDraft([
      assistant([
        {
          type: "tool-saveAutopilotWorkflow",
          toolCallId: "s1",
          state: "output-available",
          input: { name: "Watch", nodes: [] },
          output: {
            ok: true,
            workflowId: "w1",
            path: "/acme/autopilot/workflows/w1",
          },
        },
      ]),
    ]);
    expect(saved?.status).toBe("saved");
    expect(saved?.path).toBe("/acme/autopilot/workflows/w1");
    const rejected = findAutopilotWorkflowDraft([
      assistant([
        {
          type: "tool-saveAutopilotWorkflow",
          toolCallId: "s2",
          state: "output-available",
          input: { name: "Watch", nodes: [] },
          output: { ok: false, issues: ["Add a trigger"] },
        },
      ]),
    ]);
    expect(rejected?.status).toBe("needs-fixes");
    expect(rejected?.issues).toEqual(["Add a trigger"]);
  });
});

describe("Waiting on the user", () => {
  test("says what the agent waits on, and stops once answered", () => {
    const asked = {
      type: "tool-askUserQuestion",
      toolCallId: "q1",
      state: "input-available",
      input: { questions: [] },
    } as UIMessage["parts"][number];
    expect(getAssistantActivityWaitingStep([asked])).toBe("waitingForAnswer");
    expect(getAssistantActivityStep([asked])).toBe("thinking");
    const answered = {
      ...asked,
      state: "output-available",
      output: { answers: [] },
    } as UIMessage["parts"][number];
    expect(getAssistantActivityWaitingStep([answered])).toBeUndefined();
    const approval = {
      type: "tool-saveAutopilotWorkflow",
      toolCallId: "s1",
      state: "approval-requested",
      input: {},
      approval: { id: "a1" },
    } as UIMessage["parts"][number];
    expect(getAssistantActivityWaitingStep([approval])).toBe(
      "waitingForApproval"
    );
  });
});

describe("Agent errors", () => {
  const messages = {
    usageLimit: "Out of messages",
    fallback: "The agent couldn't respond.",
  };
  const shown = (error: Error) => {
    let message = null as string | null;
    handleStandaloneChatError(error, {
      setChatError: (value) => {
        message = value;
      },
      messages,
    });
    return message;
  };

  test("never shows a raw network error", () => {
    expect(shown(new Error('{"error":"fetch failed"}'))).toBe(
      "The agent couldn't respond."
    );
    expect(shown(new Error("Failed to fetch"))).toBe(
      "The agent couldn't respond."
    );
  });

  test("keeps messages written for people", () => {
    expect(
      shown(
        new Error(
          '{"error":"A response is already being generated for this chat"}'
        )
      )
    ).toBe("A response is already being generated for this chat");
    expect(shown(new Error('{"code":"USAGE_LIMIT_REACHED"}'))).toBe(
      "Out of messages"
    );
  });
});

describe("Approving a workflow", () => {
  const save = (state: string, extra: Record<string, unknown> = {}) =>
    ({
      type: "tool-saveAutopilotWorkflow",
      toolCallId: "s1",
      state,
      input: {
        workflowId: "w1",
        name: "Watch",
        schedule: { frequency: "weekly", dayOfWeek: 4, hour: 8, minute: 0 },
        nodes: [
          { id: "trigger", type: "core.trigger", title: "Mondays" },
          {
            id: "geo",
            type: "autopilot.compare-visibility",
            title: "Compare",
            config: { days: 14 },
          },
        ],
        edges: [{ source: "trigger", target: "geo" }],
      },
      ...extra,
    }) as UIMessage["parts"][number];

  test("shows a discard and a save the moment they're clicked", () => {
    expect(
      findAutopilotWorkflowDraft([
        assistant([
          save("approval-responded", {
            approval: { id: "a", approved: false },
          }),
        ]),
      ])?.status
    ).toBe("discarded");
    expect(
      findAutopilotWorkflowDraft([
        assistant([
          save("approval-responded", { approval: { id: "a", approved: true } }),
        ]),
      ])?.status
    ).toBe("saving");
  });

  test("names the trigger after the proposed schedule", () => {
    const draft = findAutopilotWorkflowDraft([
      assistant([save("approval-requested", { approval: { id: "a" } })]),
    ]);
    expect(draft?.view.nodes[0]?.title).toBe("Thursdays at 08:00 UTC");
    expect(draft?.workflowId).toBe("w1");
  });

  test("says what a change does to the saved workflow", () => {
    const draft = findAutopilotWorkflowDraft([
      assistant([save("approval-requested", { approval: { id: "a" } })]),
    ]);
    if (!draft) {
      throw new Error("no draft");
    }
    expect(
      describeAutopilotWorkflowChanges(
        {
          name: "Watch",
          description: null,
          schedule: { frequency: "weekly", dayOfWeek: 2, hour: 10, minute: 0 },
          view: {
            // Wired the same, so only the steps themselves differ.
            edges: draft.view.edges,
            nodes: [
              { id: "trigger", type: "core.trigger", title: "Tuesdays" },
              {
                id: "geo",
                type: "autopilot.compare-visibility",
                title: "Compare",
                settings: [{ label: "days", value: "7" }],
              },
              { id: "slack", type: "autopilot.post-to-slack", title: "Tell" },
            ],
          } as never,
        },
        draft
      )
    ).toEqual([
      {
        kind: "schedule",
        from: "Tuesdays at 10:00 UTC",
        to: "Thursdays at 08:00 UTC",
      },
      { kind: "changed", id: "geo", title: "Compare" },
      { kind: "removed", id: "slack", title: "Tell" },
    ]);
  });

  test("finds the discard the agent still owes a reply", () => {
    const tools = new Set(["saveAutopilotWorkflow"]);
    const discarded = assistant([
      { type: "step-start" },
      save("approval-responded", { approval: { id: "a", approved: false } }),
    ]);
    expect(findContinuableDenial([discarded], tools)).toBe("a");
    const answered = assistant([
      { type: "step-start" },
      save("output-denied", { approval: { id: "a", approved: false } }),
    ]);
    expect(findContinuableDenial([answered], tools)).toBeNull();
  });
});

describe("Agent status while it works", () => {
  test("keeps showing until the answer has words", () => {
    const working = (text: string) =>
      getChatActivity(
        [
          assistant([
            { type: "step-start" },
            {
              type: "tool-getGeoOverview",
              toolCallId: "g1",
              state: "output-available",
              input: {},
              output: {},
            } as UIMessage["parts"][number],
            { type: "step-start" },
            { type: "text", text, state: "streaming" },
          ]),
        ],
        true,
        { isStandaloneTool: () => true }
      ).showThinkingIndicator;
    expect(working("")).toBe(true);
    expect(working("In the last")).toBe(false);
  });
});

describe("What an edit changes", () => {
  const node = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: "autopilot.post-to-slack",
    title: id,
    ...extra,
  });
  const version = (
    nodes: unknown[],
    edges: unknown[] = [],
    description: string | null = null
  ) => ({
    name: "W",
    description,
    schedule: null,
    view: { nodes, edges } as never,
  });

  test("reports a step moved to another branch", () => {
    const nodes = [node("check"), node("tell")];
    expect(
      describeAutopilotWorkflowChanges(
        version(nodes, [
          { id: "e1", source: "check", sourcePort: "yes", target: "tell" },
        ]),
        version(nodes, [
          { id: "e1", source: "check", sourcePort: "no", target: "tell" },
        ])
      )
    ).toEqual([{ kind: "rewired", id: "tell", title: "tell" }]);
  });

  test("reports removed settings and a new error policy", () => {
    expect(
      describeAutopilotWorkflowChanges(
        version([
          node("a", { settings: [{ label: "Project", value: "Acme" }] }),
        ]),
        version([node("a", { onError: "continue" })])
      )
    ).toEqual([{ kind: "changed", id: "a", title: "a" }]);
  });

  test("a setting saved with its keys reordered is unchanged", () => {
    const rule = (value: unknown) => [
      { label: "rule", value: autopilotWorkflowSettingValue(value) },
    ];
    expect(
      describeAutopilotWorkflowChanges(
        version([
          node("a", {
            settings: rule({ value: true, subject: "x", operator: "equals" }),
          }),
        ]),
        version([
          node("a", {
            settings: rule({ operator: "equals", subject: "x", value: true }),
          }),
        ])
      )
    ).toEqual([]);
  });

  test("keeps a description left out, reports a new one", () => {
    const saved = version([node("a")], [], "Old");
    expect(
      describeAutopilotWorkflowChanges(saved, version([node("a")]))
    ).toEqual([]);
    expect(
      describeAutopilotWorkflowChanges(saved, version([node("a")], [], "New"))
    ).toEqual([{ kind: "description" }]);
  });
});
