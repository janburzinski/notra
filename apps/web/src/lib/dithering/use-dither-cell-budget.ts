import { useEffect, useState } from "react";
import type { RefObject } from "react";

import { DITHER_DEFAULT_CELL_SIZE } from "@/constants/dithering";

// The dithering shader paints flat cells of `size` CSS pixels, so rendering
// more than one canvas pixel per cell only repeats work. Capping the pixel
// count to the cell count makes the shader draw each cell once; the canvas is
// then upscaled with `image-rendering: pixelated` and looks the same.
export function useDitherCellBudget(
  ref: RefObject<HTMLElement | null>,
  size: number = DITHER_DEFAULT_CELL_SIZE
) {
  const [budget, setBudget] = useState<number | undefined>(undefined);

  useEffect(() => {
    const node = ref.current;
    if (!node || size <= 0) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) {
        return;
      }
      setBudget(Math.ceil(width / size) * Math.ceil(height / size));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, size]);

  return budget;
}
