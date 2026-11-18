import { beforeEach, expect, mock, test } from "bun:test";

import { Effect } from "effect";

import { GeoConversationRunInProgressError } from "../src/geo/errors";
import { deferred } from "./utils/deferred";
import {
  isIsolatedTestWorker,
  testInIsolatedProcess,
} from "./utils/isolated-process";

if (!isIsolatedTestWorker(import.meta.url)) {
  testInIsolatedProcess(
    "geo-conversation-run-claim runs with process-isolated module mocks",
    import.meta.url
  );
} else {
  const store = new Map<string, string>();
  let failSet = false;
  mock.module("@notra/ai/utils/redis", () => ({
    redis: {
      set: async (key: string, value: string, options: { nx?: boolean }) => {
        if (failSet) {
          throw new Error("Redis unavailable");
        }
        if (options.nx && store.has(key)) {
          return null;
        }
        store.set(key, value);
        return "OK";
      },
      eval: async (_script: string, keys: string[], args: string[]) => {
        const [key] = keys;
        if (key && store.get(key) === args[0]) {
          store.delete(key);
          return 1;
        }
        return 0;
      },
    },
  }));

  const { withGeoConversationRunClaim } =
    await import("../src/utils/geo-conversation-run-claim");
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const claim = {
    kind: "sequence" as const,
    organizationId: "org_a",
    id: "seq_1",
  };

  beforeEach(() => {
    store.clear();
    failSet = false;
  });

  test("a second run of the same conversation fails while the first is in flight", async () => {
    const gate = deferred<void>();
    const first = Effect.runPromise(
      withGeoConversationRunClaim(
        claim,
        Effect.promise(() => gate.promise).pipe(Effect.as("first"))
      )
    );
    await tick();

    const second = await Effect.runPromise(
      Effect.flip(withGeoConversationRunClaim(claim, Effect.succeed("second")))
    );
    expect(second).toBeInstanceOf(GeoConversationRunInProgressError);

    gate.resolve();
    expect(await first).toBe("first");
    expect(store.size).toBe(0);
    expect(
      await Effect.runPromise(
        withGeoConversationRunClaim(claim, Effect.succeed("third"))
      )
    ).toBe("third");
  });

  test("a failed run frees the claim", async () => {
    await Effect.runPromise(
      Effect.flip(withGeoConversationRunClaim(claim, Effect.fail("boom")))
    );
    expect(store.size).toBe(0);
  });

  test("runs of other conversations and organizations are independent", async () => {
    const gate = deferred<void>();
    const first = Effect.runPromise(
      withGeoConversationRunClaim(
        claim,
        Effect.promise(() => gate.promise)
      )
    );
    await tick();
    const others = await Promise.all([
      Effect.runPromise(
        withGeoConversationRunClaim(
          { ...claim, id: "seq_2" },
          Effect.succeed("other id")
        )
      ),
      Effect.runPromise(
        withGeoConversationRunClaim(
          { ...claim, organizationId: "org_b" },
          Effect.succeed("other org")
        )
      ),
      Effect.runPromise(
        withGeoConversationRunClaim(
          { ...claim, kind: "persona" },
          Effect.succeed("persona")
        )
      ),
    ]);
    expect(others).toEqual(["other id", "other org", "persona"]);
    gate.resolve();
    await first;
  });

  test("a finished run does not free a claim another run took over", async () => {
    const gate = deferred<void>();
    const first = Effect.runPromise(
      withGeoConversationRunClaim(
        claim,
        Effect.promise(() => gate.promise)
      )
    );
    await tick();
    // The first claim expired and another run claimed the conversation.
    const [key] = [...store.keys()];
    store.set(key as string, "someone-else");
    gate.resolve();
    await first;
    expect(store.get(key as string)).toBe("someone-else");
  });

  test("the run goes ahead unguarded when Redis fails", async () => {
    failSet = true;
    expect(
      await Effect.runPromise(
        withGeoConversationRunClaim(claim, Effect.succeed("ran"))
      )
    ).toBe("ran");
  });
}
