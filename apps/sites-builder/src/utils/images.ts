import {
  IMAGE_MIME_TYPES,
  IMAGE_URL_EXTENSION,
  VECTOR_IMAGE_PATH,
} from "../constants/seo";

export function imageMimeType(url: string): string | undefined {
  const { pathname } = new URL(url);
  const extension = IMAGE_URL_EXTENSION.exec(pathname)?.[1]?.toLowerCase();
  return extension && Object.hasOwn(IMAGE_MIME_TYPES, extension)
    ? IMAGE_MIME_TYPES[extension]
    : undefined;
}

/** Whether social networks can show the image as a link preview. */
export function isShareableImage(path: string): boolean {
  return !VECTOR_IMAGE_PATH.test(path);
}
