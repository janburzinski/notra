export interface TrackerRelease {
  script: string;
  /** Subresource Integrity value for the script tag, `sha384-<base64>`. */
  integrity: string;
}

export interface TrackerReleaseLink {
  /** `notra.<version>.js` or `notra.plus.<version>.js`. */
  file: string;
  integrity: string;
}
