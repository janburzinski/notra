import { useState } from "react";

import type { RemoteImageProps } from "@/types/ui";

/**
 * An avatar or badge hosted on X. Those URLs stop working when someone changes their picture, so a
 * failed load falls back to the same empty square as a missing image instead of a broken-image icon.
 */
export function RemoteImage({
  src,
  size,
  className,
  placeholderClassName,
}: RemoteImageProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={placeholderClassName} />;
  }
  return (
    <img
      alt=""
      className={className}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      src={src}
      width={size}
    />
  );
}
