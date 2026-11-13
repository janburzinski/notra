import type {
  PlanBadgeFinish,
  PlanBadgeTier,
} from "@/types/billing/plan-badge";

export const PLAN_BADGE_FINISHES: Record<PlanBadgeTier, PlanBadgeFinish> = {
  starter: { tint: [0.86, 0.88, 0.93], iridescence: 0, glint: 0.45 },
  growth: { tint: [0.82, 0.74, 1], iridescence: 0, glint: 0.7 },
  scale: { tint: [0.96, 0.96, 1], iridescence: 0.85, glint: 0.9 },
};
