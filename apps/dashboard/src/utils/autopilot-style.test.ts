import { describe, expect, test } from "bun:test";

import { TONE_PROFILE_GUIDANCE } from "@notra/ai/constants/tone";

import type { AutopilotRunContext } from "@/types/autopilot";

import { brandToneInstruction } from "./autopilot-style";

const brand: NonNullable<AutopilotRunContext["brand"]> = {
  name: "Acme",
  websiteUrl: "https://acme.test",
  description: "",
  audience: null,
  language: "English",
  customInstructions: null,
  toneProfile: null,
  customTone: null,
  settingsId: "brand",
};

describe("brandToneInstruction", () => {
  test("is empty without a brand or a tone", () => {
    expect(brandToneInstruction(null)).toBe("");
    expect(brandToneInstruction(brand)).toBe("");
    expect(brandToneInstruction({ ...brand, customTone: "  " })).toBe("");
  });

  test("gives the named profile's guidance", () => {
    const instruction = brandToneInstruction({
      ...brand,
      toneProfile: "Formal",
    });
    expect(instruction).toContain("authoritative for voice");
    expect(instruction).toContain('<tone profile="Formal">');
    expect(instruction).toContain(TONE_PROFILE_GUIDANCE.Formal);
  });

  test("custom tone notes win over the named profile", () => {
    const instruction = brandToneInstruction({
      ...brand,
      toneProfile: "Formal",
      customTone: "Dry humour, short sentences.",
    });
    expect(instruction).toContain("Dry humour, short sentences.");
    expect(instruction).not.toContain(TONE_PROFILE_GUIDANCE.Formal);
  });
});
