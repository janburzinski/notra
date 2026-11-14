import type { useRender } from "@base-ui/react/use-render";

import type {
  HEADING_SIZE_CLASSES,
  TEXT_SIZE_CLASSES,
  TEXT_TONE_CLASSES,
  TEXT_WEIGHT_CLASSES,
} from "../constants/typography";

export type HeadingSize = keyof typeof HEADING_SIZE_CLASSES;
export type TextSize = keyof typeof TEXT_SIZE_CLASSES;
export type TextTone = keyof typeof TEXT_TONE_CLASSES;
export type TextWeight = keyof typeof TEXT_WEIGHT_CLASSES;

export type HeadingProps = useRender.ComponentProps<"h2"> & {
  /** Display step. Independent of the heading level, which `render` sets. */
  size?: HeadingSize;
};

export type TextProps = useRender.ComponentProps<"p"> & {
  size?: TextSize;
  /** Leave unset to inherit the surrounding colour. */
  tone?: TextTone;
  /** Leave unset to inherit the surrounding weight. */
  weight?: TextWeight;
};
