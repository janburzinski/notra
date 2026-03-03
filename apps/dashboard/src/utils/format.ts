export function formatSnakeCaseLabel(value: string): string {
  return value.replaceAll("_", " ").trim();
}

export function truncateText(value: string, maxLength: number): string {
  if (maxLength <= 0) {
    return "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  const hiddenCharacters = value.length - maxLength;
  if (hiddenCharacters <= 3) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}
