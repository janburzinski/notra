export type PlanBadgeTier = "starter" | "growth" | "scale";

export interface PlanBadgeFinish {
  tint: readonly [number, number, number];
  iridescence: number;
  glint: number;
}
