import { expect, test } from "bun:test";

import { siteBranchLabel } from "./site-branch-label";

test("branch labels keep the deployment name and humanize titled Notra branches", () => {
  expect(siteBranchLabel("main", "en", "Edit")).toBe("main");
  expect(siteBranchLabel("notra/site-edit-new-homepage", "en", "Edit")).toBe(
    "New homepage"
  );
});

test("generated branches show a short date instead of the timestamp and random suffix", () => {
  const label = siteBranchLabel(
    "notra/site-edit-20261019213217-800834",
    "en",
    "Edit"
  );
  expect(label).toMatch(/^Edit · Oct 19$/);
  expect(label).not.toContain("800834");
  expect(
    siteBranchLabel("notra/site-edit-20261019213217-800834", "de", "Änderung")
  ).toContain("Änderung ·");
});
