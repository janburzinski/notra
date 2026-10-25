export const MS_PER_SECOND = 1000;
const ESCAPE = String.fromCharCode(27);
const BELL = String.fromCharCode(7);
// OSC bodies exclude ESC/BEL so an unterminated sequence stops at the next
// escape instead of rescanning the rest of the log.
export const ANSI_SEQUENCE = new RegExp(
  `${ESCAPE}\\][^${ESCAPE}${BELL}]*(?:${BELL}|${ESCAPE}\\\\)|${ESCAPE}\\[[0-?]*[ -/]*[@-~]`,
  "g"
);
export const SECONDS_PER_MINUTE = 60;
