import { cn } from "@notra/ui/lib/utils";

import {
  LANDING_ENGINE_ICONS,
  LANDING_ENGINE_IMAGES,
} from "@/constants/landing/geo-engines";
import type { LandingEngineIconProps } from "@/types/landing/geo";

export function LandingEngineIcon({
  engine,
  className,
}: LandingEngineIconProps) {
  const iconClass = cn(
    "size-4 shrink-0",
    engine === "gemini" && "overflow-visible",
    className
  );
  const images = LANDING_ENGINE_IMAGES[engine];
  if (images) {
    const [lightSrc, darkSrc] = images;
    return (
      <span aria-hidden="true" className="contents">
        <img
          alt=""
          className={cn(iconClass, darkSrc && "block dark:hidden")}
          decoding="async"
          height={16}
          src={lightSrc}
          width={16}
        />
        {darkSrc ? (
          <img
            alt=""
            className={cn(iconClass, "hidden dark:block")}
            decoding="async"
            height={16}
            src={darkSrc}
            width={16}
          />
        ) : null}
      </span>
    );
  }
  const [Light, Dark] = LANDING_ENGINE_ICONS[engine];
  return (
    <span aria-hidden="true" className="contents">
      {Dark ? (
        <>
          <Light className={cn(iconClass, "block dark:hidden")} />
          <Dark className={cn(iconClass, "hidden dark:block")} />
        </>
      ) : (
        <Light className={iconClass} />
      )}
    </span>
  );
}
