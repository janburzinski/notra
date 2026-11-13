const numberFormat = new Intl.NumberFormat("en-US");

export function formatScore(score: number) {
  return numberFormat.format(score);
}

export function shareUrl(text: string, url: string) {
  const intent = new URL("https://x.com/intent/post");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  return intent.toString();
}
