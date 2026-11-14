"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";

import {
  HEADING_SIZE_CLASSES,
  TEXT_SIZE_CLASSES,
  TEXT_TONE_CLASSES,
  TEXT_WEIGHT_CLASSES,
} from "../constants/typography";
import type { HeadingProps, TextProps } from "../types/typography";

/**
 * A Satoshi headline from the display scale. Renders an `h2`; pass
 * `render={<h1 />}` for another level, since size doesn't imply a level.
 */
export function Heading({
  size = "section",
  className,
  render,
  ...props
}: HeadingProps) {
  return useRender({
    defaultTagName: "h2",
    render,
    props: mergeProps<"h2">(
      {
        // The size stays outside cn: merge tables read `text-display-*` as a
        // colour and would drop it next to a colour in `className`.
        className: `${HEADING_SIZE_CLASSES[size]} ${cn("font-display text-balance", className)}`,
      },
      props
    ),
  });
}

/** Body copy in Inter. Renders a `p`; pass `render={<span />}` inline. */
export function Text({
  size = "base",
  tone,
  weight,
  className,
  render,
  ...props
}: TextProps) {
  return useRender({
    defaultTagName: "p",
    render,
    props: mergeProps<"p">(
      {
        className: cn(
          "text-pretty",
          TEXT_SIZE_CLASSES[size],
          tone && TEXT_TONE_CLASSES[tone],
          weight && TEXT_WEIGHT_CLASSES[weight],
          className
        ),
      },
      props
    ),
  });
}
