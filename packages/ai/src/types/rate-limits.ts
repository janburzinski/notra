export interface ChatGenerationRateLimit {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds at which the window rolls over. */
  reset: number;
}
