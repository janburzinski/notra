import type { MessageResponseProps } from "@notra/ui/components/ai-elements/message";
import type { ComponentProps } from "react";

/**
 * Shows the pull request's own images, which the server read and keyed in
 * the body. Data URLs can't go in the Markdown: the renderer blocks them, so
 * they are swapped in on the rendered <img>, where an SVG can't run scripts.
 */
export function postImageComponents(
  images: Record<string, string>
): MessageResponseProps["components"] {
  if (Object.keys(images).length === 0) {
    return undefined;
  }
  return {
    img: ({
      alt,
      node: _node,
      src,
      ...props
    }: ComponentProps<"img"> & { node?: unknown }) => (
      <img
        {...props}
        alt={alt ?? ""}
        className="max-w-full rounded-lg"
        src={typeof src === "string" ? (images[src] ?? src) : src}
      />
    ),
  };
}
