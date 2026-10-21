import { SITE_EDIT_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";

export function siteBranchLabel(name: string, locale: string, edit: string) {
  if (!name.startsWith(SITE_EDIT_BRANCH_PREFIX)) {
    return name;
  }
  const title = name.slice(SITE_EDIT_BRANCH_PREFIX.length);
  const timestamp =
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-[a-f0-9]+$/.exec(title);
  if (timestamp) {
    const [, year, month, day, hour, minute, second] = timestamp;
    const date = new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
    );
    if (!Number.isNaN(date.getTime())) {
      return `${edit} · ${new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
      }).format(date)}`;
    }
  }
  const label = title.replaceAll("-", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
