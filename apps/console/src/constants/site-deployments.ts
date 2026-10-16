export const MS_PER_SECOND = 1000;
const ESCAPE = String.fromCharCode(27);
const BELL = String.fromCharCode(7);
export const ANSI_SEQUENCE = new RegExp(
  `${ESCAPE}\\][\\s\\S]*?(?:${BELL}|${ESCAPE}\\\\)|${ESCAPE}\\[[0-?]*[ -/]*[@-~]`,
  "g"
);
export const SECONDS_PER_MINUTE = 60;
