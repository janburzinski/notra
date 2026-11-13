import { useEffect, useState } from "react";

import { LoadError } from "@/components/load-error";
import { RemoteImage } from "@/components/remote-image";
import { COMPANY_TOP_PILOTS } from "@/constants/leaderboard";
import type { CompanyBoardLoadState, CompanyBoardProps } from "@/types/ui";
import { fetchCompanies } from "@/utils/api-client";
import { formatScore } from "@/utils/format";

/** Companies ranked by their pilots: everyone with an X affiliation badge plays for their company. */
export function CompanyBoard({ version, companyId }: CompanyBoardProps) {
  const [state, setState] = useState<CompanyBoardLoadState>({
    status: "loading",
  });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    fetchCompanies()
      .then((data) => active && setState({ status: "ready", data }))
      .catch(
        (error: Error) =>
          active && setState({ status: "error", message: error.message })
      );
    return () => {
      active = false;
    };
  }, [version, refresh]);

  const entries = state.status === "ready" ? state.data.entries : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="bg-space/60 min-h-0 flex-1 overflow-y-auto">
        {state.status === "error" && (
          <LoadError
            message={state.message}
            onRetry={() => {
              setState({ status: "loading" });
              setRefresh((value) => value + 1);
            }}
          />
        )}
        {state.status === "loading" && (
          <p className="animate-blink font-display text-ink-3 p-4 text-xs">
            Loading…
          </p>
        )}
        {state.status === "ready" && entries.length === 0 && (
          <p className="text-ink-3 p-4 text-sm">
            No companies yet. Sign in with an X account that has a company badge
            and put your company on the board.
          </p>
        )}
        {entries.length > 0 && (
          <ol className="flex flex-col">
            {entries.map((entry) => {
              let rowTint = entry.rank % 2 === 0 ? "bg-space/40" : "";
              if (entry.company.id === companyId) {
                rowTint = "bg-violet-deep/30";
              }
              return (
                <li
                  className={`flex items-center gap-2 px-2.5 py-1.5 ${rowTint}`}
                  key={entry.company.id}
                >
                  <span
                    className={`font-display w-5 shrink-0 text-right text-xs tabular-nums ${entry.rank <= 3 ? "text-gold" : "text-ink-3"}`}
                  >
                    {formatScore(entry.rank)}
                  </span>
                  <RemoteImage
                    className="bg-space-3 size-6 shrink-0"
                    placeholderClassName="bg-space-3 size-6 shrink-0"
                    size={24}
                    src={entry.company.badge}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    {entry.company.url ? (
                      <a
                        className="hover:text-violet truncate text-xs"
                        title={entry.company.name}
                        href={entry.company.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {entry.company.name}
                      </a>
                    ) : (
                      <span
                        className="truncate text-xs"
                        title={entry.company.name}
                      >
                        {entry.company.name}
                      </span>
                    )}
                    <span className="text-ink-3 truncate text-xs">
                      {entry.players} {entry.players === 1 ? "pilot" : "pilots"}
                      {entry.top ? ` · best @${entry.top.handle}` : ""}
                    </span>
                  </span>
                  <span className="font-display min-w-16 shrink-0 text-right text-xs tabular-nums">
                    {formatScore(entry.score)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <p className="text-ink-3 text-xs">
        Got a company badge on X? Your all-time best counts for your company.
        Its top {COMPANY_TOP_PILOTS} pilots add up.
      </p>
    </div>
  );
}
