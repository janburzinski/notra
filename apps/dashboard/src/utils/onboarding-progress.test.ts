import { describe, expect, test } from "bun:test";

import {
  ONBOARDING_STEP_AUTOPILOT,
  ONBOARDING_STEP_COMPETITORS,
  ONBOARDING_STEP_PRICING,
  ONBOARDING_STEP_VISIBILITY,
  ONBOARDING_STEP_WORKSPACE,
} from "@/constants/onboarding";

import { onboardingProgressHrefs } from "./onboarding-progress";

const base = {
  hasOrganization: true,
  hasBrand: true,
  stage: "complete" as const,
  projectId: "project_b",
};

describe("onboarding progress", () => {
  test("keeps the four-step flow while the Autopilot flag is off", () => {
    const steps = onboardingProgressHrefs({
      ...base,
      autopilot: false,
      current: ONBOARDING_STEP_PRICING,
    });
    expect(steps.map((entry) => entry.step)).toEqual([
      ONBOARDING_STEP_WORKSPACE,
      ONBOARDING_STEP_VISIBILITY,
      ONBOARDING_STEP_COMPETITORS,
      ONBOARDING_STEP_PRICING,
    ]);
    expect(steps.some((entry) => entry.href?.includes("autopilot"))).toBe(
      false
    );
    expect(steps.at(-1)?.href).toBeNull();
  });

  test("adds the Autopilot step before pricing when the flag is on", () => {
    const steps = onboardingProgressHrefs({
      ...base,
      autopilot: true,
      current: ONBOARDING_STEP_PRICING,
    });
    expect(steps.map((entry) => entry.step)).toEqual([
      ONBOARDING_STEP_WORKSPACE,
      ONBOARDING_STEP_VISIBILITY,
      ONBOARDING_STEP_COMPETITORS,
      ONBOARDING_STEP_AUTOPILOT,
      ONBOARDING_STEP_PRICING,
    ]);
    expect(steps[3]?.href).toBe("/onboarding/autopilot?project=project_b");
    expect(steps.at(-1)?.href).toBeNull();
  });

  test("keeps replay and project scope on every link", () => {
    const steps = onboardingProgressHrefs({
      ...base,
      autopilot: true,
      current: ONBOARDING_STEP_AUTOPILOT,
      replay: true,
    });
    for (const entry of steps) {
      if (entry.step === ONBOARDING_STEP_AUTOPILOT) {
        expect(entry.href).toBeNull();
        continue;
      }
      expect(entry.href).toContain("project=project_b");
      expect(entry.href).toContain("replay=1");
    }
  });

  test("locks Autopilot and pricing until the competitors step is done", () => {
    const steps = onboardingProgressHrefs({
      ...base,
      autopilot: true,
      stage: "competitors",
      current: ONBOARDING_STEP_COMPETITORS,
    });
    expect(steps.map((entry) => entry.href !== null)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
