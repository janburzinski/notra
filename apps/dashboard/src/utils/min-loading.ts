import { sleep } from "@notra/utils/sleep";

import { MIN_LOADING_MS } from "@/constants/loading";

/** Settles like `work`, but never before `MIN_LOADING_MS` have passed. */
export async function withMinLoading<T>(work: Promise<T>): Promise<T> {
  const [result] = await Promise.allSettled([work, sleep(MIN_LOADING_MS)]);
  if (result.status === "rejected") {
    throw result.reason;
  }
  return result.value;
}
