import { expect, mock, test } from "bun:test";

import type { GeoPromptSequence } from "@notra/geo-core/types/geo";
import { renderToStaticMarkup } from "react-dom/server";

let isLoading = false;
let sequences: GeoPromptSequence[] = [];

mock.module("@/lib/hooks/use-geo-db", () => ({
  useGeoSequencesDb: () => ({
    sequences,
    isLoading,
    pendingSequenceIds: new Set(),
    updateSequence: mock(),
    removeSequence: mock(),
  }),
}));
mock.module("@/lib/hooks/use-geo", () => ({
  useGeoRunSequence: () => ({ isPending: false, mutate: mock() }),
  useGeoSequencesGenerate: () => ({ isPending: false, mutate: mock() }),
}));
mock.module("@/components/motion/table", () => ({ Table: () => null }));
mock.module("@/components/geo/conversation-builder-dialog", () => ({
  ConversationBuilderDialog: () => null,
}));
mock.module("@/components/geo/conversation-results-dialog", () => ({
  ConversationResultsDialog: () => null,
}));

const { ConversationsCard } =
  await import("../src/components/geo/conversations-card");

test("offers generation only after loading an empty conversation list", () => {
  const render = () =>
    renderToStaticMarkup(<ConversationsCard organizationId="fixture" />);

  expect(render()).toContain(">Generate</button>");
  isLoading = true;
  expect(render()).not.toContain(">Generate</button>");
  isLoading = false;
  sequences = [
    {
      id: "existing",
      name: "Compare changelog tools",
      steps: ["Which changelog tool should I use?"],
      enabled: true,
      createdAt: "2026-09-20T12:00:00Z",
    },
  ];
  expect(render()).not.toContain(">Generate</button>");
  expect(render()).toContain("New Conversation");
});
