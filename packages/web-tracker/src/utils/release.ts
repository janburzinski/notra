/** File name a build is archived and served under. */
export function trackerReleaseFile(version: string, plus: boolean): string {
  return plus ? `notra.plus.${version}.js` : `notra.${version}.js`;
}
