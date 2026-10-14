import { useEffect, useState } from "react";

import { GEO_LOG_ARRIVE_ANIMATION_MS } from "@/constants/geo-citations";
import type {
  ArrivedRowIdsInput,
  ArrivedRowIdsState,
} from "@/types/arrived-row-ids";

const NO_ARRIVALS: ReadonlyMap<string, number> = new Map();

/**
 * Marks rows that appear in `ids` after the first load of one view, in table
 * order, so a live table can open them one by one. `viewKey` names the view
 * (page, filter, scan): changing it rebases silently instead of animating
 * rows that were merely out of sight.
 */
export function useArrivedRowIds({
  ids,
  viewKey,
  ready,
  enabled,
}: ArrivedRowIdsInput): ReadonlyMap<string, number> {
  const [state, setState] = useState<ArrivedRowIdsState>(() => ({
    viewKey,
    known: new Set(ids),
    arrived: new Map(),
  }));
  const isNewView = state.viewKey !== viewKey;
  const fresh = ids.filter((id) => !state.known.has(id));
  if (ready && (isNewView || fresh.length > 0)) {
    setState({
      viewKey,
      known: new Set([...(isNewView ? [] : state.known), ...ids]),
      arrived:
        isNewView || !enabled
          ? new Map()
          : new Map([
              ...state.arrived,
              ...fresh.map((id, slot): [string, number] => [id, slot]),
            ]),
    });
  }
  const { arrived } = state;
  useEffect(() => {
    if (arrived.size === 0) {
      return;
    }
    const clear = setTimeout(
      () => setState((prev) => ({ ...prev, arrived: new Map() })),
      GEO_LOG_ARRIVE_ANIMATION_MS
    );
    return () => clearTimeout(clear);
  }, [arrived]);

  return ready ? arrived : NO_ARRIVALS;
}
