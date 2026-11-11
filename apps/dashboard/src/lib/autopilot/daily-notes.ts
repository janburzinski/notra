import { openMemorySnapshot } from "@notra/memory/memory";

import { AUTOPILOT_DREAM_RECENT_DAYS } from "@/constants/autopilot-dream";
import { newestDailyNotes } from "@/utils/autopilot-dream";

export async function loadRecentDailyNotes(organizationId: string) {
  try {
    const snapshot = await openMemorySnapshot(organizationId);
    const paths = newestDailyNotes(
      await snapshot.list(),
      AUTOPILOT_DREAM_RECENT_DAYS
    );
    const notes = await Promise.all(
      paths.map(async (path) => ({
        date: path.slice("daily/".length, -".md".length),
        note: (await snapshot.read(path))?.trim() ?? "",
      }))
    );
    return notes.filter((row) => row.note);
  } catch {
    return [];
  }
}
