import { describe, expect, test } from "bun:test";

import { autopilotUpdateSettingsInputSchema } from "@notra/ai/schemas/autopilot-agent";
import { AUTOPILOT_MAX_WORKSPACE_REVIEWERS } from "@notra/db/constants/autopilot";
import { autopilotUpdateInputSchema } from "@notra/schemas/dashboard/autopilot";

import {
  normalizeAutopilotReviewers,
  splitAutopilotReviewers,
} from "./autopilot-reviewers";

describe("Autopilot reviewers", () => {
  test("are saved without @, lowercase and once each", () => {
    expect(
      normalizeAutopilotReviewers([
        " @Maria ",
        "maria",
        "Acme/Docs",
        "acme/docs",
      ])
    ).toEqual(["maria", "acme/docs"]);
  });

  test("split into users and the repository organization's team slugs", () => {
    expect(
      splitAutopilotReviewers(
        ["maria", "@acme/docs", "Acme/Growth", "other/docs"],
        "Acme"
      )
    ).toEqual({
      users: ["maria"],
      teams: ["docs", "growth"],
      otherTeams: ["other/docs"],
    });
  });

  test("the dashboard and Slack accept logins and org/team, nothing else", () => {
    const valid = ["octocat", "@octocat", "acme/docs", "acme/docs.team_2"];
    const invalid = [
      "",
      "-octocat",
      "octo cat",
      "acme/",
      "acme/docs/extra",
      "dependabot[bot]",
      "https://github.com/octocat",
    ];
    for (const schema of [
      autopilotUpdateInputSchema,
      autopilotUpdateSettingsInputSchema,
    ]) {
      const parse = (reviewers: string[]) =>
        schema.safeParse({ organizationId: "org_1", reviewers }).success;
      expect(parse(valid)).toBe(true);
      expect(parse([])).toBe(true);
      for (const reviewer of invalid) {
        expect(parse([reviewer])).toBe(false);
      }
      expect(
        parse(
          Array.from(
            { length: AUTOPILOT_MAX_WORKSPACE_REVIEWERS + 1 },
            (_, index) => `user${index}`
          )
        )
      ).toBe(false);
    }
  });
});
