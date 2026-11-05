import { describe, expect, test } from "bun:test";

import { hashTrigger } from "@notra/ai/utils/trigger-hash";
import {
  createScheduleRequestSchema,
  patchScheduleRequestSchema,
} from "@notra/schemas/api/schedules";
import { configureScheduleBodySchema } from "@notra/schemas/dashboard/integrations";

import {
  hashSchedule,
  mergeSchedulePatch,
  normalizeSchedule,
} from "../src/utils/schedules";

const stored = createScheduleRequestSchema.parse({
  name: "Weekly summary",
  sourceType: "cron",
  sourceConfig: {
    cron: { frequency: "weekly", hour: 9, minute: 0, dayOfWeek: 1 },
  },
  targets: { repositoryIds: ["repo-a"], linearIntegrationIds: ["team-a"] },
  outputType: "changelog",
  outputConfig: {
    brandVoiceId: "voice-a",
    instructions: "Lead with fixes",
    notify: { slack: true, email: false },
  },
  enabled: true,
  autoPublish: true,
  lookbackWindow: "last_14_days",
});

function merge(patch: unknown) {
  return mergeSchedulePatch(stored, patchScheduleRequestSchema.parse(patch));
}

describe("schedule targets", () => {
  test("accept Linear alone, GitHub alone, or both, but never neither", () => {
    const base = { ...stored, outputConfig: undefined };
    const linearOnly = createScheduleRequestSchema.parse({
      ...base,
      targets: { linearIntegrationIds: ["team-a"] },
    });
    expect(linearOnly.targets).toEqual({
      repositoryIds: [],
      linearIntegrationIds: ["team-a"],
    });
    expect(
      createScheduleRequestSchema.safeParse({
        ...base,
        targets: { repositoryIds: [], linearIntegrationIds: [] },
      }).success
    ).toBe(false);
  });

  test("hash a Linear selection exactly like the dashboard does", () => {
    const body = createScheduleRequestSchema.parse({
      ...stored,
      targets: { repositoryIds: ["repo-a"], linearIntegrationIds: ["b", "a"] },
    });
    const dashboard = configureScheduleBodySchema.parse(body);
    expect(normalizeSchedule(body).targets.linearIntegrationIds).toEqual([
      "a",
      "b",
    ]);
    expect(hashSchedule(normalizeSchedule(body))).toBe(
      hashTrigger({
        ...dashboard,
        instructions: dashboard.outputConfig?.instructions,
        brandVoiceId: dashboard.outputConfig?.brandVoiceId,
      })
    );
  });
});

describe("schedule PATCH merge", () => {
  test("keeps every field the request leaves out", () => {
    const result = merge({ enabled: false });
    expect(result.success && result.data).toEqual({
      ...stored,
      enabled: false,
    });
  });

  test("merges targets and outputConfig per field and clears with null", () => {
    const result = merge({
      targets: { linearIntegrationIds: [] },
      outputConfig: { instructions: null, publishDestination: "custom" },
    });
    expect(result.success && result.data.targets).toEqual({
      repositoryIds: ["repo-a"],
      linearIntegrationIds: [],
    });
    expect(result.success && result.data.outputConfig).toEqual({
      brandVoiceId: "voice-a",
      notify: { slack: true, email: false },
      publishDestination: "custom",
    });
    const cleared = merge({ outputConfig: null });
    expect(cleared.success && cleared.data.outputConfig).toBeUndefined();
  });

  test("validates the merged schedule", () => {
    expect(
      merge({ targets: { repositoryIds: [], linearIntegrationIds: [] } })
        .success
    ).toBe(false);
    expect(
      patchScheduleRequestSchema.safeParse({
        sourceConfig: { cron: { frequency: "monthly", hour: 9, minute: 0 } },
      }).success
    ).toBe(false);
    expect(patchScheduleRequestSchema.safeParse({}).success).toBe(false);
  });

  test("needs a complete body when the stored row is unreadable", () => {
    const patch = patchScheduleRequestSchema.parse({ name: "Renamed" });
    expect(mergeSchedulePatch(null, patch).success).toBe(false);
    const full = patchScheduleRequestSchema.parse({
      ...stored,
      outputConfig: undefined,
    });
    expect(mergeSchedulePatch(null, full).success).toBe(true);
  });
});
