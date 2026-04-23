export function getFeedbackPageUrl(pathname: string): string | undefined {
  if (typeof window === "undefined") {
    return;
  }

  return `${window.location.origin}${pathname}`;
}
