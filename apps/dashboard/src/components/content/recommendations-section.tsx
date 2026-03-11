"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import type { ReactNode } from "react";

interface RecommendationsSectionProps {
  value: string | null;
}

const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_RE = /\*(.+?)\*/g;
const BULLET_RE = /^[-*]\s+/;

function inlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldMatch = BOLD_RE.exec(remaining);
    BOLD_RE.lastIndex = 0;

    if (boldMatch?.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(<strong key={`b-${keyIdx++}`}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    const italicMatch = ITALIC_RE.exec(remaining);
    ITALIC_RE.lastIndex = 0;

    if (italicMatch?.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(remaining.slice(0, italicMatch.index));
      }
      parts.push(<em key={`i-${keyIdx++}`}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    parts.push(remaining);
    break;
  }

  return parts;
}

function markdownToElements(markdown: string): ReactNode {
  const lines = markdown.split("\n");
  const elements: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) {
      return;
    }
    elements.push(
      <ul key={`ul-${elements.length}`}>
        {bulletBuffer.map((item, idx) => (
          <li key={`li-${idx}-${item.slice(0, 20)}`}>{inlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushBullets();
      continue;
    }

    if (BULLET_RE.test(trimmed)) {
      bulletBuffer.push(trimmed.replace(BULLET_RE, ""));
      continue;
    }

    flushBullets();
    elements.push(
      <p key={`p-${elements.length}`}>{inlineMarkdown(trimmed)}</p>
    );
  }

  flushBullets();
  return elements;
}

export function RecommendationsSection({ value }: RecommendationsSectionProps) {
  if (!value?.trim()) {
    return null;
  }

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground [&[data-panel-open]>svg]:rotate-0">
        <HugeiconsIcon
          className="-rotate-90 transition-transform"
          icon={ArrowDown01Icon}
          size={14}
        />
        Recommendations
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none pt-2">
          {markdownToElements(value)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
