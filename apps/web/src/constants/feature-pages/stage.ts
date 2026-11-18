import type { FeatureStageImage } from "@/types/feature-detail-page";

export const FEATURE_STAGE_IMAGE: FeatureStageImage = {
  src: "/features/stage/sky.jpg",
  author: "StockSnap",
  authorUrl: "https://pixabay.com/users/stocksnap-894430/",
  photoUrl: "https://pixabay.com/photos/purple-sky-clouds-sunset-2618708/",
};

// Stage cards stay white in dark mode, so their badges keep the light tokens.
export const FEATURE_STAGE_LIGHT_BADGE_TOKENS =
  "dark:[--background:white] dark:[--badge-secondary:hsl(0_0%_96.1%)] dark:[--badge-success:oklch(0.46_0.109_155)] dark:[--badge-warning:oklch(0.46_0.113_55)] dark:[--secondary-foreground:hsl(0_0%_9%)] dark:[--success:oklch(0.55_0.109_155)] dark:[--warning:oklch(0.57_0.113_55)]";
