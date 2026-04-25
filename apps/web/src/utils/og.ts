const GOOGLE_FONT_URL_REGEX =
  /src: url\((.+)\) format\('(opentype|truetype)'\)/;

export async function loadGoogleFont(family: string, text: string) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(
    / /g,
    "+"
  )}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const fontUrl = css.match(GOOGLE_FONT_URL_REGEX)?.[1];
  if (!fontUrl) {
    throw new Error(`Failed to resolve font URL for ${family}`);
  }
  const fontResponse = await fetch(fontUrl);
  if (!fontResponse.ok) {
    throw new Error(`Failed to fetch font file for ${family}`);
  }
  return fontResponse.arrayBuffer();
}

export function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
