const DAY_PAD_LENGTH = 2;

export function localDayString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(DAY_PAD_LENGTH, "0");
  const day = String(date.getDate()).padStart(DAY_PAD_LENGTH, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseLocalDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1);
}
