import type { FC } from "react";

export interface BrushProps {
  height?: number; // brush preview strip height in px (default 56)
  formatLabel?: (value: string, index: number) => string; // formats the range-handle labels
  onChange?: (range: { startIndex: number; endIndex: number }) => void; // fires as the range moves
}

/** Configures the chart's brush; the chart reads its props and renders the strip itself. */
export const Brush: FC<BrushProps> = () => null;
