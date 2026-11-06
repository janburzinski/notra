import { EMULATED_GOOGLE_FONT } from "../../emulators/google-fonts/constants";

/** The fixture's blog.json with a heading font from the Google Fonts emulator. */
export function withEmulatedGoogleFont(
  config: string
): Uint8Array<ArrayBuffer> {
  const json = JSON.parse(config) as Record<string, unknown>;
  return new TextEncoder().encode(
    `${JSON.stringify(
      { ...json, fonts: { heading: { family: EMULATED_GOOGLE_FONT } } },
      null,
      2
    )}\n`
  );
}
