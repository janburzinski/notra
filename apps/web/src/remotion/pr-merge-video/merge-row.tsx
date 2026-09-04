import { Img, useCurrentFrame, useVideoConfig } from "remotion";

import type { PrMergeRowProps } from "../../types/pr-merge-video";
import {
  BALL_DIAMETER,
  BALL_SPEED_PER_MERGE,
  BALL_TRACK_LEFT,
  BALL_TRACK_RIGHT,
  LABEL_LEFT,
  MAX_ROW_HEIGHT,
  PR_MERGE_VIDEO_HEIGHT,
  ROWS_BOTTOM,
  ROWS_TOP,
} from "./constants";

export function MergeRow({
  person,
  index,
  total,
  fontFamily,
}: PrMergeRowProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rowHeight = Math.min(
    MAX_ROW_HEIGHT,
    (PR_MERGE_VIDEO_HEIGHT - ROWS_TOP - ROWS_BOTTOM) / total
  );
  const centerY = ROWS_TOP + rowHeight * (index + 0.5);
  const diameter = Math.min(BALL_DIAMETER, rowHeight - 12);
  const travelDistance = BALL_TRACK_RIGHT - BALL_TRACK_LEFT;
  const distance = (frame / fps) * person.merges * BALL_SPEED_PER_MERGE;
  const bounceProgress = distance % (travelDistance * 2);
  const centerX =
    BALL_TRACK_LEFT +
    (bounceProgress <= travelDistance
      ? bounceProgress
      : travelDistance * 2 - bounceProgress);

  return (
    <div style={{ fontFamily }}>
      <div
        style={{
          position: "absolute",
          top: centerY,
          left: LABEL_LEFT,
          width: 270,
          transform: "translateY(-50%)",
        }}
      >
        <div
          style={{
            color: "#171717",
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {person.name || person.login}
        </div>
        <div
          style={{
            color: "#737373",
            fontSize: 21,
            lineHeight: 1.25,
            marginTop: 9,
          }}
        >
          {person.merges.toLocaleString("en-US")}{" "}
          {person.merges === 1 ? "merge" : "merges"}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: centerX,
          top: centerY,
          width: diameter,
          height: diameter,
          borderRadius: "50%",
          overflow: "hidden",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Img
          src={person.avatarUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </div>
  );
}
