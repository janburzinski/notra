import { DeferredDithering } from "@/components/deferred-dithering";
import { BLOG_CARD_DITHER_MAX_PIXELS } from "@/constants/dithering";
import type { BlogCardDitherProps } from "@/types/dithering";
import { getBlogCardDither } from "@/utils/blog-card-dither";

export function BlogCardDither({ slug }: BlogCardDitherProps) {
  return (
    <DeferredDithering
      {...getBlogCardDither(slug)}
      className="pointer-events-none absolute inset-x-0 -bottom-8 -z-10 h-48 w-full mask-[linear-gradient(to_bottom,transparent_0%,black_100%)]"
      colorBack="#00000000"
      colorFront="#9B7ACC33"
      fit="cover"
      maxPixelCount={BLOG_CARD_DITHER_MAX_PIXELS}
      shape="wave"
      size={3}
      type="4x4"
      unmountOffscreen
    />
  );
}
