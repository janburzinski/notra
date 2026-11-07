"use client";

import { BubbleChatQuestionIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";
import { useTranslations } from "use-intl";

import type { AgentQuestionCardProps } from "@/types/agent-questions";
import { readAgentAnswers, readAgentQuestions } from "@/utils/agent-questions";

/**
 * What the agent asked and what you answered, kept in the conversation. The
 * questions themselves are answered where the chat input was.
 */
export function AgentQuestionCard({
  input,
  output,
  state,
}: AgentQuestionCardProps) {
  const t = useTranslations("ai.agentQuestion");
  const questions = readAgentQuestions(input);
  // Open questions show where the chat input was, not twice.
  if (
    questions.length === 0 ||
    state === "input-streaming" ||
    state === "input-available"
  ) {
    return null;
  }
  const answers = readAgentAnswers(output);
  const dismissed = state === "output-error";

  return (
    <div className={cn(TABLE_FRAME_CLASS, "w-full min-w-0")}>
      <p className="text-muted-foreground flex items-center gap-2 px-3 pt-1.5 pb-2 text-xs">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5 shrink-0"
          icon={BubbleChatQuestionIcon}
          strokeWidth={1.5}
        />
        {t("asked", { count: questions.length })}
      </p>
      <dl
        className={cn(
          TABLE_BODY_CLASS,
          "divide-table-row-border divide-y overflow-hidden"
        )}
      >
        {questions.map((question, index) => {
          const answer = answers?.[index] ?? [];
          let value = t("unanswered");
          if (dismissed) {
            value = t("dismissed");
          } else if (answer.length > 0) {
            value = answer.join(", ");
          }
          return (
            <div className="space-y-0.5 px-3 py-2.5" key={question.question}>
              <dt className="text-muted-foreground text-xs text-pretty">
                {question.question}
              </dt>
              <dd
                className={cn(
                  "text-sm text-pretty",
                  answer.length === 0 && "text-muted-foreground"
                )}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
