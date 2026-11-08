import type { ReportRow, RunSample, VendorResult } from "./types";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function pick(samples: RunSample[], key: keyof RunSample): number {
  return median(samples.map((sample) => sample[key]));
}

function toRows(results: VendorResult[]): ReportRow[] {
  const baseline = results.find((result) => result.vendor.id === "none");
  const base = (key: keyof RunSample) =>
    baseline ? pick(baseline.samples, key) : 0;
  return results
    .filter((result) => result.vendor.id !== "none")
    .map(({ vendor, size, samples }) => ({
      id: vendor.id,
      name: vendor.name,
      ...size,
      loadMs: pick(samples, "loadMs"),
      interactionMs: pick(samples, "interactionMs"),
      totalMs: median(samples.map((s) => s.loadMs + s.interactionMs)),
      heapKb: Math.max(
        0,
        (pick(samples, "heapBytes") - base("heapBytes")) / 1024
      ),
      listeners: Math.max(0, pick(samples, "listeners") - base("listeners")),
      intervals: pick(samples, "intervals") - base("intervals"),
      animationFrames:
        pick(samples, "animationFrames") - base("animationFrames"),
      mutationObservers:
        pick(samples, "mutationObservers") - base("mutationObservers"),
      requests: pick(samples, "requests"),
      uploadBytes: pick(samples, "uploadBytes"),
      preflights: pick(samples, "preflights"),
      longTasks: Math.max(0, pick(samples, "longTasks") - base("longTasks")),
    }))
    .sort((a, b) => a.gzip - b.gzip);
}

const fixed = (value: number, digits = 1) => value.toFixed(digits);

function markdown(rows: ReportRow[], header: string): string {
  const lines = [
    header,
    "",
    "| Tracker | Gzip | Brotli | Load CPU | Interaction CPU | Total CPU | Heap | Listeners | Intervals | rAF calls | MutationObservers | Requests | Upload | Preflights |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map(
      (row) =>
        `| ${row.name} | ${row.gzip} B | ${row.brotli} B | ${fixed(row.loadMs)} ms | ${fixed(row.interactionMs)} ms | **${fixed(row.totalMs)} ms** | ${fixed(row.heapKb)} KB | ${row.listeners} | ${row.intervals} | ${row.animationFrames} | ${row.mutationObservers} | ${row.requests} | ${row.uploadBytes} B | ${row.preflights} |`
    ),
  ];
  return lines.join("\n");
}

function bars(
  rows: ReportRow[],
  key: keyof ReportRow,
  unit: string,
  digits = 0
): string {
  const max = Math.max(...rows.map((row) => Number(row[key])), 1);
  return rows
    .map((row) => {
      const value = Number(row[key]);
      const width = Math.max(0.5, (value / max) * 100);
      const ours = row.id === "notra";
      return `<div class="row${ours ? " ours" : ""}"><span class="label">${row.name}</span><span class="track"><span class="bar" style="width:${width}%"></span></span><span class="value">${value.toFixed(digits)} ${unit}</span></div>`;
    })
    .join("");
}

function html(rows: ReportRow[], header: string): string {
  const charts: [string, keyof ReportRow, string, number][] = [
    ["Script size (gzip)", "gzip", "B", 0],
    [
      "Main-thread time, load + interaction (4× CPU slowdown)",
      "totalMs",
      "ms",
      1,
    ],
    ["Retained JS heap", "heapKb", "KB", 1],
    ["Network requests per visit", "requests", "", 0],
    ["Bytes uploaded per visit", "uploadBytes", "B", 0],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Tracker benchmark</title><style>
body{font:14px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;background:#0b0b0c;color:#e8e8ea;margin:0;padding:32px 40px}
h1{font-size:22px;margin:0 0 4px}p.meta{color:#9a9aa2;margin:0 0 24px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(560px,1fr));gap:20px}
section{background:#141416;border:1px solid #232327;border-radius:12px;padding:16px 18px}
h2{font-size:13px;font-weight:600;color:#b9b9c0;margin:0 0 12px;text-transform:uppercase;letter-spacing:.04em}
.row{display:grid;grid-template-columns:230px 1fr 90px;align-items:center;gap:10px;margin:6px 0;color:#c9c9cf}
.row.ours{color:#fff;font-weight:600}.track{background:#1d1d21;border-radius:6px;height:14px;overflow:hidden}
.bar{display:block;height:100%;background:#4b4b55;border-radius:6px}.ours .bar{background:linear-gradient(90deg,#7c5cff,#a78bfa)}
.value{text-align:right;font-variant-numeric:tabular-nums}
</style></head><body><h1>Analytics tracker benchmark</h1><p class="meta">${header}</p><div class="grid">${charts
    .map(
      ([title, key, unit, digits]) =>
        `<section><h2>${title}</h2>${bars(rows, key, unit, digits)}</section>`
    )
    .join("")}</div></body></html>`;
}

export function renderReport(
  results: VendorResult[],
  options: { runs: number; cpuSlowdown: number }
) {
  const rows = toRows(results);
  const header = `Chromium, ${options.cpuSlowdown}× CPU slowdown, 390×844 viewport, median of ${options.runs} runs per tracker. One visit: load, 10 scroll steps, 3 clicks, 3 SPA navigations, leave. Heap, listeners and timers are relative to a page without a tracker.`;
  return { markdown: markdown(rows, header), html: html(rows, header) };
}
