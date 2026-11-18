import { ditheringFragmentShader } from "@paper-design/shaders";

const PAPER_CELL_SIZE_LINE = "float pxSize = u_pxSize * u_pixelRatio;";

// Paper floors `fragCoord / (size * renderScale)` to find a pixel's cell. At
// one canvas pixel per cell that product lands near 1 but never exactly on it,
// so a row or column of cells gets skipped or doubled and shows as a seam.
// Rounding it to a whole number keeps every canvas pixel on its own cell.
const CELL_SIZE_LINE =
  "float pxSize = max(1., floor(u_pxSize * u_pixelRatio + .5));";

// Null when a Paper update changes the shader; callers then render at full
// resolution instead of one pixel per cell.
export const CELL_DITHERING_FRAGMENT_SHADER = ditheringFragmentShader.includes(
  PAPER_CELL_SIZE_LINE
)
  ? ditheringFragmentShader.replace(PAPER_CELL_SIZE_LINE, CELL_SIZE_LINE)
  : null;
