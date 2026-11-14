import { SAXParser } from "parse5-sax-parser";

import {
  CONTENT_IMAGE_ATTRIBUTE,
  CONTENT_ROOT_CLASS,
} from "../constants/content-images";
import type {
  ContentImageInfo,
  ContentImageTag,
} from "../types/content-images";

const attribute = (
  attrs: readonly { name: string; value: string }[],
  name: string
) => attrs.find((attr) => attr.name === name)?.value;

// Absolute same-origin paths only, and nothing a srcset candidate can't hold.
const OPTIMIZABLE_SRC = /^\/(?!\/)[^\s,?#&"'<>]+$/;

/**
 * Finds <img> tags inside post content, and theme images marked with
 * CONTENT_IMAGE_ATTRIBUTE, that the build can size and give a srcset.
 */
export function findContentImages(html: string): ContentImageTag[] {
  if (
    !(
      (html.includes(CONTENT_ROOT_CLASS) ||
        html.includes(CONTENT_IMAGE_ATTRIBUTE)) &&
      /<img[\s/>]/i.test(html)
    )
  ) {
    return [];
  }
  const parser = new SAXParser({ sourceCodeLocationInfo: true });
  const images: ContentImageTag[] = [];
  let rootTag: string | null = null;
  let depth = 0;
  // Body images seen so far, found or not: the first may be above the fold.
  let bodyImages = 0;
  parser.on("startTag", (token) => {
    const marked =
      token.tagName === "img" &&
      attribute(token.attrs, CONTENT_IMAGE_ATTRIBUTE) !== undefined;
    if (rootTag === null && !marked) {
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
    const inBody = rootTag !== null;
    const deferrable = inBody && bodyImages > 0;
    if (inBody) {
      bodyImages += 1;
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
    const hasWidth = attribute(token.attrs, "width") !== undefined;
    const hasHeight = attribute(token.attrs, "height") !== undefined;
    images.push({
      src,
      insertAt: html[endOffset - 2] === "/" ? endOffset - 2 : endOffset - 1,
      loading: attribute(token.attrs, "loading")?.toLowerCase(),
      hasSizes: attribute(token.attrs, "sizes") !== undefined,
      hasDimensions: hasWidth && hasHeight,
      hasAnyDimension: hasWidth || hasHeight,
      deferrable,
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
  loading: string | undefined,
  hasDimensions: boolean,
  originalWidth: number
): string {
  const sizes = `min(${originalWidth}px, 100vw)`;
  // "auto" (the rendered width) is only safe on lazy images with width and
  // height set: without them, browsers lay the image out at 300x150.
  return loading === "lazy" && hasDimensions ? `auto, ${sizes}` : sizes;
}

/** The attributes the build adds to one tag; empty when there is nothing to add. */
function addedAttributes(
  image: ContentImageTag,
  info: ContentImageInfo
): string {
  let added = "";
  let hasDimensions = image.hasDimensions;
  // width and height reserve the space, so text doesn't jump when it loads.
  // The page CSS keeps `height: auto`, so the image still scales down.
  if (!image.hasAnyDimension && info.size) {
    added += ` width="${info.size.width}" height="${info.size.height}"`;
    hasDimensions = true;
  }
  let { loading } = image;
  if (loading === undefined && image.deferrable) {
    loading = "lazy";
    added += ' loading="lazy" decoding="async"';
  }
  const { variants } = info;
  const original = variants?.at(-1);
  if (variants && original && variants.length >= 2) {
    const srcset = variants
      .map((candidate) => `${candidate.url} ${candidate.width}w`)
      .join(", ");
    added += ` srcset="${srcset}"`;
    if (!image.hasSizes) {
      added += ` sizes="${contentImageSizes(loading, hasDimensions, original.width)}"`;
    }
  }
  return added;
}

/**
 * Adds what the build knows to the found tags: width and height, lazy loading
 * for body images after the first, and a srcset (with sizes, unless the author
 * set one). Attributes the author wrote are never replaced.
 */
export function addContentImageAttributes(
  html: string,
  images: readonly ContentImageTag[],
  infoFor: (src: string) => ContentImageInfo | null
): string {
  let result = "";
  let offset = 0;
  for (const image of [...images].sort((a, b) => a.insertAt - b.insertAt)) {
    const info = infoFor(image.src);
    const added = info ? addedAttributes(image, info) : "";
    if (!added) {
      continue;
    }
    result += html.slice(offset, image.insertAt) + added;
    offset = image.insertAt;
  }
  return result + html.slice(offset);
}
