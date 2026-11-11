/**
 * Tinybird could not finish a delete yet: its queue of 3 delete jobs per
 * workspace stayed full, or a submitted job outlasted the wait. Nothing is
 * wrong with the request, so callers wait and try again rather than fail.
 */
export class TinybirdDeleteBusyError extends Error {
  override name = "TinybirdDeleteBusyError";
}
