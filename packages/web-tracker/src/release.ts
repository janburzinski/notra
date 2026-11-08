import {
  TRACKER_PLUS_SCRIPT_INTEGRITY,
  TRACKER_PLUS_SCRIPT_VERSION,
  TRACKER_SCRIPT_INTEGRITY,
  TRACKER_SCRIPT_VERSION,
} from "./generated/script";
import type { TrackerReleaseLink } from "./types/release";
import { trackerReleaseFile } from "./utils/release";

/** The current notra.js build, for a pinned script tag. */
export const TRACKER_RELEASE: TrackerReleaseLink = {
  file: trackerReleaseFile(TRACKER_SCRIPT_VERSION, false),
  integrity: TRACKER_SCRIPT_INTEGRITY,
};

/** The current notra.plus.js build, for a pinned script tag. */
export const TRACKER_PLUS_RELEASE: TrackerReleaseLink = {
  file: trackerReleaseFile(TRACKER_PLUS_SCRIPT_VERSION, true),
  integrity: TRACKER_PLUS_SCRIPT_INTEGRITY,
};
