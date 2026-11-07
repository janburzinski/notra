import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { AGENT_QUESTION_TOOL_NAME } from "@/constants/agent-questions";
import type {
  AgentMessagePart,
  AgentQuestion,
  AgentQuestionAnswer,
  PendingAgentQuestion,
} from "@/types/agent-questions";
import { isTerminalToolState } from "@/utils/chat-approvals";

export function isAgentQuestionPart(part: AgentMessagePart): boolean {
  return isToolUIPart(part) && getToolName(part) === AGENT_QUESTION_TOOL_NAME;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Reads questions that may still be streaming in; drops the unfinished ones. */
export function readAgentQuestions(input: unknown): AgentQuestion[] {
  const questions = record(input)?.questions;
  return (Array.isArray(questions) ? questions : []).flatMap((value) => {
    const question = record(value);
    const prompt = text(question?.question);
    if (!(question && prompt)) {
      return [];
    }
    const options = (
      Array.isArray(question.options) ? question.options : []
    ).flatMap((option) => {
      const label = text(record(option)?.label);
      return label
        ? [
            {
              label,
              description: text(record(option)?.description) ?? undefined,
            },
          ]
        : [];
    });
    return [
      {
        question: prompt,
        header: text(question.header) ?? "",
        options,
        multiple: question.multiple === true,
      },
    ];
  });
}

export function readAgentAnswers(
  output: unknown
): AgentQuestionAnswer[] | null {
  const answers = record(output)?.answers;
  return Array.isArray(answers)
    ? answers.map((answer) =>
        Array.isArray(answer)
          ? answer.filter((item): item is string => typeof item === "string")
          : []
      )
    : null;
}

/** The questions the agent is waiting on, if its last message ended with them. */
export function findPendingAgentQuestion(
  messages: readonly UIMessage[]
): PendingAgentQuestion | null {
  const message = messages.at(-1);
  if (message?.role !== "assistant") {
    return null;
  }
  for (const part of message.parts) {
    if (
      isToolUIPart(part) &&
      isAgentQuestionPart(part) &&
      part.state === "input-available"
    ) {
      const questions = readAgentQuestions(part.input);
      return questions.length > 0
        ? { toolCallId: part.toolCallId, questions }
        : null;
    }
  }
  return null;
}

/**
 * The question call the agent's last step ended on, once answered or
 * dismissed: the conversation goes back to the agent with it.
 */
export function findSettledAgentQuestion(messages: readonly UIMessage[]) {
  const message = messages.at(-1);
  if (message?.role !== "assistant") {
    return null;
  }
  const lastStepStart = message.parts.findLastIndex(
    (part) => part.type === "step-start"
  );
  const toolParts = message.parts.slice(lastStepStart + 1).filter(isToolUIPart);
  if (!toolParts.every((part) => isTerminalToolState(part.state))) {
    return null;
  }
  const settled = toolParts.find(
    (part) =>
      getToolName(part) === AGENT_QUESTION_TOOL_NAME &&
      (part.state === "output-available" || part.state === "output-error")
  );
  return settled?.toolCallId ?? null;
}

/** The answers as the model reads them, one quoted pair per question. */
export function formatAgentAnswers(
  questions: readonly Pick<AgentQuestion, "question">[],
  answers: readonly AgentQuestionAnswer[]
) {
  const pairs = questions
    .map((question, index) => {
      const answer = answers[index] ?? [];
      return `"${question.question}"="${answer.length > 0 ? answer.join(", ") : "Unanswered"}"`;
    })
    .join(", ");
  return `User has answered your questions: ${pairs}. You can now continue with the user's answers in mind.`;
}
