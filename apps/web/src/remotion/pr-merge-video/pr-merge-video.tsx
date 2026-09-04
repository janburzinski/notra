import { AbsoluteFill } from "remotion";

import type { PrMergeVideoInputProps } from "../../types/pr-merge-video";
import { ensureStarVideoFonts } from "../star-video/load-fonts";
import { MergeRow } from "./merge-row";

ensureStarVideoFonts();

const fontFamily = 'Inter, "Helvetica Neue", Arial, system-ui, sans-serif';

export function PrMergeVideo({
  owner,
  repo,
  days,
  people,
}: PrMergeVideoInputProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff", fontFamily }}>
      <div
        style={{
          position: "absolute",
          top: 68,
          left: 70,
          right: 70,
        }}
      >
        <div
          style={{
            color: "#171717",
            fontSize: 43,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
          }}
        >
          Pull requests merged in the past {days} days
        </div>
        <div
          style={{
            color: "#8a8a8a",
            fontSize: 22,
            marginTop: 15,
            letterSpacing: "-0.01em",
          }}
        >
          {owner}/{repo}
        </div>
      </div>

      {people.map((person, index) => (
        <MergeRow
          fontFamily={fontFamily}
          index={index}
          key={person.login}
          person={person}
          total={people.length}
        />
      ))}
    </AbsoluteFill>
  );
}
