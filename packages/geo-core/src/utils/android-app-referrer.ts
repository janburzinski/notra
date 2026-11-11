import {
  WEB_ANDROID_APP_PROTOCOL,
  WEB_ANDROID_PACKAGE_PATTERN,
} from "../constants/web-analytics";

/** The lowercased package an `android-app://<package>/` referrer names, else null. */
export function androidAppPackage(referer: string | undefined): string | null {
  const url = referer ? URL.parse(referer) : null;
  if (url?.protocol !== WEB_ANDROID_APP_PROTOCOL) {
    return null;
  }
  const name = url.hostname.toLowerCase();
  return WEB_ANDROID_PACKAGE_PATTERN.test(name) ? name : null;
}
