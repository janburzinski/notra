import { GEO_ANALYTICS_QUERY_FAILED_MESSAGE } from "../constants/analytics";

export async function runGeoTool<T>(
  toolName: string,
  run: () => Promise<T>
): Promise<T | string> {
  try {
    return await run();
  } catch (error) {
    console.error(`[Tools] ${toolName} failed:`, error);
    return GEO_ANALYTICS_QUERY_FAILED_MESSAGE;
  }
}
