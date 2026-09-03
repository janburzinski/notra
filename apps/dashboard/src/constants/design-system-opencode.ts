import type {
  OpencodeStoryActivity,
  OpencodeStorySession,
} from "@/types/design-system-opencode";

export const OPENCODE_STORY_SESSION: OpencodeStorySession = {
  title: "OpenCode — ~/acme/web",
  userMessage: "draft a changelog from this week's merged PRs and post it",
  assistantMessage:
    "I'll pull the week's merged work, draft the changelog in your voice, and publish it.",
  activities: [
    {
      id: "prepare",
      kind: "thought",
      label: "Preparing changelog workflow",
      duration: "1.4s",
    },
    {
      id: "events",
      kind: "tool",
      label: "notra_list_events",
      detail: "range=week",
    },
    {
      id: "websearch",
      kind: "tool",
      label: "websearch",
      detail: "query=this week's product announcements",
    },
    {
      id: "draft",
      kind: "thought",
      label: "Drafting in brand voice",
      duration: "4.2s",
    },
    {
      id: "publish",
      kind: "tool",
      label: "notra_publish_post",
      detail: "type=changelog",
    },
  ],
  resultMessage: "Published. Drafted in your voice from 14 PRs in 22 seconds.",
  promptPlaceholder: 'Ask anything... "Draft a launch post"',
  cwd: "~/acme/web",
  context: "26.2K (7%)",
  tokens: "26,167 tokens",
  used: "7% used",
  servers: [
    { name: "notra", status: "Connected" },
    { name: "github", status: "Connected" },
    { name: "linear", status: "Connected" },
  ],
};

export const OPENCODE_STORY_ACTIVITIES: OpencodeStoryActivity[] = [
  {
    id: "thought",
    kind: "thought",
    label: "Preparing executor for changelog workflow",
    duration: "1.4s",
  },
  {
    id: "tool",
    kind: "tool",
    label: "notra_create_post",
    detail: "type=changelog, voice=brand",
  },
];
