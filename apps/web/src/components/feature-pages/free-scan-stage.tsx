import { Google } from "@notra/ui/components/ui/svgs/google";

import { EngineIcon } from "@/components/feature-pages/engine-icon";
import { RankBadge } from "@/components/feature-pages/rank-badge";
import { StageShell } from "@/components/feature-pages/stage-shell";
import {
  FREE_SCAN_BRAND,
  FREE_SCAN_ROWS,
  FREE_SCAN_STATS,
} from "@/constants/feature-pages/free-scan";

export function FreeScanStage() {
  return (
    <StageShell className="flex justify-center p-2.5 pb-9 sm:p-8 sm:pb-12">
      <div className="flex w-full max-w-180 flex-col overflow-clip rounded-2xl border border-white/90 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-[#EFEFEF] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-0.5 whitespace-nowrap">
            <span className="font-sans text-[0.9375rem]/5 font-semibold text-[#1E1E1E]">
              {FREE_SCAN_BRAND}
            </span>
            <span className="font-sans text-[0.8125rem]/4 text-[#6B6B6B]">
              First scan · 4 min
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[#E4E4E4] px-3 py-1.5">
            <EngineIcon className="size-3.5" engine="chatgpt" />
            <Google aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="font-sans text-[0.8125rem]/4 font-medium text-[#1E1E1E]">
              30 answers
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 border-b border-[#EFEFEF]">
          {FREE_SCAN_STATS.map((stat) => (
            <div
              className="flex min-w-0 flex-col-reverse gap-1 border-r border-[#EFEFEF] px-3 py-3.5 last:border-r-0 sm:px-5 sm:py-4"
              key={stat.label}
            >
              <dt className="font-sans text-[0.6875rem]/4 whitespace-nowrap text-[#8A8A8A] sm:text-xs/4">
                {stat.label}
              </dt>
              <dd className="font-sans text-lg/7 font-semibold text-[#1E1E1E] tabular-nums sm:text-2xl/8">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="flex flex-col">
          {FREE_SCAN_ROWS.slice(0, 3).map((row) => (
            <li
              className="flex items-center justify-between gap-4 border-b border-[#EFEFEF] px-4 py-3 last:border-b-0 sm:px-5 sm:py-3.5"
              key={row.prompt}
            >
              <span className="font-sans text-sm/5 text-[#1E1E1E] sm:text-[0.9375rem]/5">
                {row.prompt}
              </span>
              <RankBadge rank={row.rank} />
            </li>
          ))}
        </ul>
      </div>
    </StageShell>
  );
}
