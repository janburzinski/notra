"use client";

import { OG_THEME } from "@notra/sites-og/constants/og-images";

import type { SiteThumbnailLayoutSketchProps } from "@/types/site-share-image";

/** A rounded line of text; heights are about the cap height of the real type. */
function Line({
  x,
  y,
  width,
  height,
  fill,
  opacity = 1,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity?: number;
}) {
  return (
    <rect
      fill={fill}
      height={height}
      opacity={opacity}
      rx={height / 2}
      width={width}
      x={x}
      y={y}
    />
  );
}

/**
 * A wireframe of a share image layout, drawn on the card's own 1200×630 grid
 * so each block sits where the real layout puts it.
 */
export function SiteThumbnailLayoutSketch({
  layout,
  appearance,
  accent,
}: SiteThumbnailLayoutSketchProps) {
  const { background, text, muted } = OG_THEME[appearance];
  return (
    <svg
      className="border-border block aspect-[1200/630] w-full border-b"
      viewBox="0 0 1200 630"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={background} height="630" width="1200" />
      {layout === "default" ? (
        <>
          <rect fill={accent} height="12" width="1200" />
          <Line
            fill={muted}
            height={18}
            opacity={0.6}
            width={260}
            x={88}
            y={98}
          />
          <Line
            fill={text}
            height={38}
            opacity={0.85}
            width={900}
            x={88}
            y={235}
          />
          <Line
            fill={text}
            height={38}
            opacity={0.85}
            width={600}
            x={88}
            y={315}
          />
          <circle cx={96} cy={540} fill={accent} r={9} />
          <Line
            fill={muted}
            height={18}
            opacity={0.6}
            width={280}
            x={122}
            y={531}
          />
        </>
      ) : null}
      {layout === "author" ? (
        <>
          <rect fill={accent} height={56} rx={14} width={56} x={80} y={80} />
          <Line
            fill={muted}
            height={14}
            opacity={0.6}
            width={170}
            x={950}
            y={101}
          />
          <Line
            fill={text}
            height={38}
            opacity={0.85}
            width={960}
            x={80}
            y={199}
          />
          <Line
            fill={text}
            height={38}
            opacity={0.85}
            width={620}
            x={80}
            y={269}
          />
          <circle cx={112} cy={518} fill={muted} opacity={0.45} r={32} />
          <Line fill={text} height={18} width={210} x={160} y={498} />
          <Line
            fill={muted}
            height={13}
            opacity={0.6}
            width={140}
            x={160}
            y={528}
          />
          <Line
            fill={muted}
            height={15}
            opacity={0.6}
            width={190}
            x={930}
            y={511}
          />
        </>
      ) : null}
      {layout === "article" ? (
        <>
          <Line fill={text} height={18} width={150} x={80} y={84} />
          <Line
            fill={muted}
            height={18}
            opacity={0.6}
            width={130}
            x={250}
            y={84}
          />
          <Line
            fill={text}
            height={38}
            opacity={0.85}
            width={940}
            x={80}
            y={175}
          />
          <Line
            fill={text}
            height={38}
            opacity={0.85}
            width={540}
            x={80}
            y={253}
          />
          <Line
            fill={muted}
            height={15}
            opacity={0.5}
            width={780}
            x={80}
            y={430}
          />
          <Line
            fill={muted}
            height={15}
            opacity={0.5}
            width={520}
            x={80}
            y={462}
          />
          <circle cx={105} cy={530} fill={accent} r={25} />
          <circle
            cx={143}
            cy={530}
            fill={muted}
            r={25}
            stroke={background}
            strokeWidth={6}
          />
          <Line fill={text} height={18} width={240} x={186} y={521} />
        </>
      ) : null}
    </svg>
  );
}
