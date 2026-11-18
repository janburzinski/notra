import { cn } from "@notra/ui/lib/utils";
import {
  DitheringShapes,
  DitheringTypes,
  ditheringFragmentShader,
  getShaderColorFromString,
  ShaderFitOptions,
} from "@paper-design/shaders";
import { ShaderMount } from "@paper-design/shaders-react";
import { useSyncExternalStore } from "react";

import {
  DITHER_DEFAULT_CELL_SIZE,
  DITHER_MOBILE_MAX_PIXELS,
} from "@/constants/dithering";
import { CELL_DITHERING_FRAGMENT_SHADER } from "@/constants/dithering-shader";
import { useDitherCellBudget } from "@/lib/dithering/use-dither-cell-budget";
import { useDitherPainted } from "@/lib/dithering/use-dither-painted";
import type { DitheringCanvasProps } from "@/types/dithering";
import {
  getDitherEnvironmentServerSnapshot,
  getDitherMobileSnapshot,
  subscribeToDitherViewport,
} from "@/utils/dither-environment";

function minDefined(...values: (number | undefined)[]) {
  const defined = values.filter((value) => value !== undefined);
  return defined.length > 0 ? Math.min(...defined) : undefined;
}

export function DitheringShader({
  className,
  speed,
  maxPixelCount,
  animate = true,
  onPainted,
  colorBack = "#000000",
  colorFront = "#00b2ff",
  shape = "sphere",
  type = "4x4",
  size = DITHER_DEFAULT_CELL_SIZE,
  fit = "none",
  scale = 0.6,
  offsetX = 0,
  offsetY = 0,
  frame = 0,
}: DitheringCanvasProps) {
  const isMobile = useSyncExternalStore(
    subscribeToDitherViewport,
    getDitherMobileSnapshot,
    getDitherEnvironmentServerSnapshot
  );
  const paintRef = useDitherPainted(onPainted);
  const cellBudget = useDitherCellBudget(paintRef, size);
  const pixelCap =
    maxPixelCount ?? (isMobile ? DITHER_MOBILE_MAX_PIXELS : undefined);
  const renderPerCell = CELL_DITHERING_FRAGMENT_SHADER !== null;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      ref={paintRef}
    >
      <ShaderMount
        className={cn(
          "h-full w-full",
          renderPerCell && "[&_canvas]:[image-rendering:pixelated]"
        )}
        fragmentShader={
          CELL_DITHERING_FRAGMENT_SHADER ?? ditheringFragmentShader
        }
        frame={frame}
        maxPixelCount={
          renderPerCell ? minDefined(cellBudget, pixelCap) : pixelCap
        }
        minPixelRatio={isMobile ? 1 : undefined}
        speed={animate ? speed : 0}
        uniforms={{
          u_colorBack: getShaderColorFromString(colorBack),
          u_colorFront: getShaderColorFromString(colorFront),
          u_shape: DitheringShapes[shape],
          u_type: DitheringTypes[type],
          u_pxSize: size,
          u_fit: ShaderFitOptions[fit],
          u_scale: scale,
          u_rotation: 0,
          u_offsetX: offsetX,
          u_offsetY: offsetY,
          u_originX: 0.5,
          u_originY: 0.5,
          u_worldWidth: 0,
          u_worldHeight: 0,
        }}
      />
    </div>
  );
}
