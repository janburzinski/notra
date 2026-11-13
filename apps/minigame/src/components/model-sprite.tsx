import { useEffect, useRef } from "react";

import { SPRITE_SIZE } from "@/constants/game";
import { spriteSheet } from "@/lib/game/sprites";
import type { ModelSpriteProps } from "@/types/ui";

/** A model's ship exactly as it looks in game, scaled up in whole pixels. */
export function ModelSprite({ model, scale = 3, className }: ModelSpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = SPRITE_SIZE + 2;

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(spriteSheet()[model].ship, 0, 0);
  }, [model, size]);

  return (
    <canvas
      aria-hidden="true"
      className={`pixelated ${className ?? ""}`}
      height={size}
      ref={ref}
      style={{ width: size * scale, height: size * scale }}
      width={size}
    />
  );
}
