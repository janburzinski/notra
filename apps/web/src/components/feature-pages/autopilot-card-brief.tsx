import { cn } from "@notra/ui/lib/utils";

import { MockFrame } from "@/components/landing/mock-frame";
import { AUTOPILOT_BRIEF_CARD } from "@/constants/feature-pages/autopilot";

const INK = "text-[#1D1C1D] dark:text-white";
const MUTED = "text-[#616061] dark:text-white/60";

function NotraAvatar({ size }: { size: "md" | "sm" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-white ring-1 ring-[#1E1E1E]/10 dark:bg-white",
        size === "md" ? "size-9 rounded-lg" : "size-6 rounded-md"
      )}
    >
      <img
        alt=""
        className={size === "md" ? "size-5" : "size-3.5"}
        height={20}
        src="/notra-mark.svg"
        width={20}
      />
    </span>
  );
}

function SenderLine({ time }: { time: string }) {
  const { sender, badge } = AUTOPILOT_BRIEF_CARD;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn("text-[0.9375rem] font-bold", INK)}>{sender}</span>
      <span className="rounded-sm bg-[#1D1C1D]/[0.07] px-1 py-px text-[0.625rem] font-bold text-[#616061] dark:bg-white/10 dark:text-white/60">
        {badge}
      </span>
      <span className={cn("text-xs", MUTED)}>{time}</span>
    </div>
  );
}

// The brief as Slack shows it: the message, its thread, and the reply each
// item gets so you can react on it.
export function AutopilotCardBrief() {
  const { frame, headline, waitingLabel, waiting, thread, reply } =
    AUTOPILOT_BRIEF_CARD;

  return (
    <MockFrame heading={frame.heading} subhead={frame.subhead}>
      <div className="flex flex-col">
        <div className="flex gap-2.5 px-4 pt-3.5 pb-3">
          <NotraAvatar size="md" />
          <div className="flex min-w-0 grow flex-col gap-1.5 text-[0.9375rem]/[1.375rem]">
            <SenderLine time={AUTOPILOT_BRIEF_CARD.time} />
            <p className={cn("font-bold", INK)}>{headline}</p>
            <div className={cn("text-sm", INK)}>
              <p className="font-bold">{waitingLabel}</p>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {waiting.map((item) => (
                  <li className="flex min-w-0 gap-2" key={item.title}>
                    <span aria-hidden="true">•</span>
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{item.title}</span>
                      <span className={MUTED}> · {item.meta}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <NotraAvatar size="sm" />
              <span className={cn("text-xs font-bold", INK)}>
                {thread.replies}
              </span>
              <span className={cn("text-xs", MUTED)}>{thread.last}</span>
            </div>
          </div>
        </div>
        <div className="border-border flex gap-2.5 border-t bg-[#F8F8F8] px-4 py-3 dark:bg-white/[0.03]">
          <NotraAvatar size="md" />
          <div className="flex min-w-0 grow flex-col gap-1">
            <SenderLine time={reply.time} />
            <p className={cn("min-w-0 truncate text-sm", INK)}>
              <span className="font-bold">{reply.title}</span>
              <span className={MUTED}> · {reply.meta}</span>
            </p>
            <div className="flex gap-1.5 pt-0.5">
              {reply.reactions.map((reaction) => (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    reaction.mine
                      ? "bg-[#F3F0FE] text-[#5B21B6] shadow-[inset_0_0_0_1px_#C4B5FD] dark:bg-[#2B2445] dark:text-[#D5CBFF] dark:shadow-[inset_0_0_0_1px_#6D5BBF]"
                      : "bg-muted text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                  )}
                  key={reaction.emoji}
                >
                  <span>{reaction.emoji}</span>
                  {reaction.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}
