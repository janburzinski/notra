/** The promise's value if it settles within `ms`, otherwise `undefined`. */
export function settleWithin<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
