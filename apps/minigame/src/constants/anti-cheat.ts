/** The client reports its tick and state fingerprint this often while a run is live. */
export const BEAT_INTERVAL_S = 4;
/** Most heartbeats one run may store: three hours of them, with room to spare. */
export const MAX_BEATS = 3000;

/** How far game time may get ahead of the server's clock over any stretch: a delayed heartbeat. */
export const FAST_SLACK_S = 6;
/** Extra wall time allowed before the first heartbeat: a slow first load, not a pause. */
export const FIRST_BEAT_SLACK_S = 15;
/** An interval counts as a stall (a pause) when game time falls below this share of wall time… */
export const STALL_RATIO = 0.8;
/** …by more than this, so a late heartbeat isn't mistaken for one. */
export const STALL_SLACK_S = 1.5;
/** …and holds no more game time than this: one heartbeat interval plus a late heartbeat. */
export const STALL_MAX_GAME_S = BEAT_INTERVAL_S + 2;
/** Pauses allowed per run. */
export const MAX_STALLS = 8;
/** Outside pauses, game time must keep at least this pace against wall time. */
export const MIN_LIVE_RATIO = 0.95;
/** Most game time between two heartbeats; anything longer was played without reporting. */
export const BEAT_MAX_GAP_S = 20;
/** Game time allowed after the last heartbeat: the run ended before the next one was due. */
export const UNBEATEN_TAIL_S = 10;

/** A new best that lands this high on the all-time board waits on the review list for a moderator. */
export const REVIEW_TOP_RANK = 10;
