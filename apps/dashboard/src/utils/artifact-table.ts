import { ARTIFACT_SIGNED_CHANGE } from "@/constants/artifacts";
import type { ArtifactTableCellTrend } from "@/types/artifacts";

/**
 * Whether a table cell is a change, and if so whether it is good news: a rise
 * is, unless the column says lower is better. A change of zero is flat, with
 * or without a sign, so a column of changes stays one even where nothing
 * moved; any other unsigned number is not a change.
 */
export function tableCellTrend(
  cell: unknown,
  lowerIsBetter: boolean
): ArtifactTableCellTrend | null {
  if (typeof cell !== "string") {
    return null;
  }
  const match = ARTIFACT_SIGNED_CHANGE.exec(cell.trim());
  if (!match) {
    return null;
  }
  if (!/[1-9]/.test(match[2] ?? "")) {
    return "flat";
  }
  if (!match[1]) {
    return null;
  }
  const rose = match[1] === "+";
  return rose !== lowerIsBetter ? "up" : "down";
}
