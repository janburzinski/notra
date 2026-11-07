import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff?inline";
import inter500 from "@fontsource/inter/files/inter-latin-500-normal.woff?inline";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff?inline";

const INTER_FONT_DATA_URLS = {
  400: inter400,
  500: inter500,
  600: inter600,
} as const;

export function loadInterFont(weight: keyof typeof INTER_FONT_DATA_URLS) {
  const [, base64 = ""] = INTER_FONT_DATA_URLS[weight].split(",");
  return Buffer.from(base64, "base64");
}

export function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function loadImageAsDataUrl(url: string | null) {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const input = Buffer.from(await response.arrayBuffer());
    const { default: sharp } = await import("sharp");
    const png = await sharp(input).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
