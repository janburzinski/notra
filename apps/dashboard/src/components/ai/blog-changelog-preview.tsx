"use client";

import {
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkSquare01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ContentType } from "@notra/ai/schemas/content";
import { MessageResponse } from "@notra/ui/components/ai-elements/message";
import { Badge } from "@notra/ui/components/ui/badge";
import { Button } from "@notra/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@notra/ui/components/ui/collapsible";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CHAT_PREVIEW_SAVE_TIMEOUT_MS } from "@/constants/chat";
import { getOutputTypeLabel, OutputTypeIcon } from "@/utils/output-types";

type IncomingState = "draft" | "finished";
type UserAction = "none" | "approved" | "save-failed";

interface BlogChangelogPreviewProps {
  state: IncomingState;
  title: string;
  markdown: string;
  contentType: Extract<
    ContentType,
    "blog_post" | "changelog" | "investor_update"
  >;
  onApprove?: () => void;
  onDeny?: () => void;
}

export function BlogChangelogPreview({
  state: incomingState,
  title,
  markdown,
  contentType,
  onApprove,
  onDeny,
}: BlogChangelogPreviewProps) {
  const [userAction, setUserAction] = useState<UserAction>("none");

  const isFinished = incomingState === "finished" || userAction !== "none";

  useEffect(() => {
    if (userAction !== "approved" || incomingState === "finished") {
      return;
    }
    const timer = window.setTimeout(() => {
      setUserAction("save-failed");
      toast.error("Saving draft is taking longer than expected.");
    }, CHAT_PREVIEW_SAVE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [userAction, incomingState]);

  const handleApprove = useCallback(() => {
    setUserAction("approved");
    onApprove?.();
  }, [onApprove]);

  const showDraftBadge = isFinished && userAction !== "save-failed";

  return (
    <Collapsible
      defaultOpen={!isFinished}
      key={isFinished ? "collapsed" : "open"}
    >
      <div className="ml-px max-w-xl">
        <div className="rounded-lg border border-border bg-muted/80">
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 [&[data-panel-open]>svg]:rotate-90">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform"
              icon={ArrowRight01Icon}
            />
            <span className="min-w-0 truncate text-left font-medium text-sm">
              {title}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {showDraftBadge && (
                <Badge className="text-[0.625rem]" variant="outline">
                  draft
                </Badge>
              )}
              <Badge
                className="flex items-center gap-1 text-[0.625rem] capitalize"
                variant="secondary"
              >
                <OutputTypeIcon className="size-3" outputType={contentType} />
                {getOutputTypeLabel(contentType)}
              </Badge>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mx-2 mb-2">
              <div className="max-h-[24rem] overflow-y-auto rounded-lg border border-border/80 bg-background px-4 py-3">
                <MessageResponse className="text-sm leading-relaxed [&_ol]:pl-5 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground">
                  {markdown}
                </MessageResponse>
              </div>
            </div>
          </CollapsibleContent>

          {!isFinished && (
            <div className="flex items-center justify-end gap-2 px-3 pb-2">
              <Button onClick={onDeny} size="sm" variant="ghost">
                <HugeiconsIcon className="size-4" icon={Cancel01Icon} />
                Discard
              </Button>
              <Button onClick={handleApprove} size="sm">
                <HugeiconsIcon
                  className="size-4"
                  icon={CheckmarkSquare01Icon}
                />
                Save as draft
              </Button>
            </div>
          )}
        </div>
      </div>
    </Collapsible>
  );
}
