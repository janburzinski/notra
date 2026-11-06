export interface EmulatedFontFamily {
  /** A real woff2 file served for every face of the family. */
  file: Uint8Array<ArrayBuffer>;
  license: string;
  /** The weight axis of the variable font; Google rejects ranges beyond it. */
  weights: readonly [number, number];
}

export interface GoogleFontsEmulatorOptions {
  families: Record<string, EmulatedFontFamily>;
}
