import type {
  ChatTurnEvent,
  ChatTurnPhase,
} from "@/types/components/chat-page";

/** Where a chat's turn goes next: sending, stopping for the queue, or waiting on another tab. */
export function nextChatTurnPhase(
  phase: ChatTurnPhase,
  event: ChatTurnEvent
): ChatTurnPhase {
  switch (event) {
    case "send":
      return phase === "idle" ? "sending" : phase;
    case "sendQueued":
      return phase === "waitingForActiveStream" ? phase : "sendingQueued";
    case "streamStarted":
      if (phase === "sendingQueued") {
        return "sending";
      }
      return phase === "stoppingForQueue" ? "stoppedForQueue" : phase;
    case "stopForQueue":
      return phase === "waitingForActiveStream" ? phase : "stoppingForQueue";
    case "stopForQueueFailed":
      return phase === "stoppingForQueue" ? "stoppedForQueue" : phase;
    case "userStopped":
      if (phase === "stoppingForQueue") {
        return "sendingQueued";
      }
      return phase === "stoppedForQueue" ? "sending" : phase;
    case "settled":
      return phase === "waitingForActiveStream" ? phase : "idle";
    case "streamConflict":
      return "waitingForActiveStream";
    case "activeStreamEnded":
      return "idle";
    default:
      return phase;
  }
}
