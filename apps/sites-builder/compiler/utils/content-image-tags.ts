import { SAXParser } from "parse5-sax-parser";

import { CONTENT_ROOT_CLASS } from "../constants/content-images";
import type {
  ContentImageTag,
  ContentImageVariants,
} from "../types/content-images";

const attribute = (
  attrs: readonly { name: string; value: string }[],
  name: string
) => attrs.find((attr) => attr.name === name)?.value;

// Absolute same-origin paths only, and nothing a srcset candidate can't hold.
const OPTIMIZABLE_SRC = /^\/(?!\/)[^\s,?#&"'<>]+$/;

/** Finds <img> tags inside post content that can take a generated srcset. */
export function findContentImages(html: string): ContentImageTag[] {
  if (!(html.includes(CONTENT_ROOT_CLASS) && /<img[\s/>]/i.test(html))) {
    return [];
  }
  const parser = new SAXParser({ sourceCodeLocationInfo: true });
  const images: ContentImageTag[] = [];
  let rootTag: string | null = null;
  let depth = 0;
  parser.on("startTag", (token) => {
    if (rootTag === null) {
      const classes = attribute(token.attrs, "class")?.split(/\s+/) ?? [];
      if (classes.includes(CONTENT_ROOT_CLASS) && !token.selfClosing) {
        rootTag = token.tagName;
        depth = 1;
      }
      return;
    }
    if (token.tagName === rootTag && !token.selfClosing) {
      depth += 1;
      return;
    }
    if (token.tagName !== "img" || !token.sourceCodeLocation) {
      return;
    }
    const src = attribute(token.attrs, "src");
    if (
      !src ||
      !OPTIMIZABLE_SRC.test(src) ||
      attribute(token.attrs, "srcset") !== undefined
    ) {
      return;
    }
    const { endOffset } = token.sourceCodeLocation;
    images.push({
      src,
      insertAt: html[endOffset - 2] === "/" ? endOffset - 2 : endOffset - 1,
      loading: attribute(token.attrs, "loading")?.toLowerCase(),
      hasSizes: attribute(token.attrs, "sizes") !== undefined,
      hasDimensions:
        attribute(token.attrs, "width") !== undefined &&
        attribute(token.attrs, "height") !== undefined,
    });
  });
  parser.on("endTag", (token) => {
    if (rootTag !== null && token.tagName === rootTag) {
      depth -= 1;
      if (depth === 0) {
        rootTag = null;
      }
    }
  });
  parser.end(html);
  return images;
}

/**
 * `sizes` that leaves the layout exactly as it was without a srcset. With width
 * descriptors, an image's natural width becomes its `sizes` width, so anything
 * larger would stretch images narrower than their container.
 */
function contentImageSizes(
  image: ContentImageTag,
  originalWidth: number
): string {
  const sizes = `min(${originalWidth}px, 100vw)`;
  // "auto" (the rendered width) is only safe on lazy images with width and
  // height set: without them, browsers lay the image out at 300x150.
  return image.loading === "lazy" && image.hasDimensions
    ? `auto, ${sizes}`
    : sizes;
}

/** Adds srcset (and sizes, unless the author set one) to the found tags. */
export function addContentImageSrcsets(
  html: string,
  images: readonly ContentImageTag[],
  variantsFor: (src: string) => ContentImageVariants
): string {
  let result = "";
  let offset = 0;
  for (const image of [...images].sort((a, b) => a.insertAt - b.insertAt)) {
    const variants = variantsFor(image.src);
    const original = variants?.at(-1);
    if (!(variants && original) || variants.length < 2) {
      continue;
    }
    const srcset = variants
      .map((candidate) => `${candidate.url} ${candidate.width}w`)
      .join(", ");
    let added = ` srcset="${srcset}"`;
    if (!image.hasSizes) {
      added += ` sizes="${contentImageSizes(image, original.width)}"`;
    }
    result += html.slice(offset, image.insertAt) + added;
    offset = image.insertAt;
  }
  return result + html.slice(offset);
}
