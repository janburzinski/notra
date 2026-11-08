export interface Vendor {
  id: string;
  name: string;
  tag: string;
  url?: string;
}

export interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: { data?: { url?: string } };
}

export interface RunSample {
  loadMs: number;
  interactionMs: number;
  heapBytes: number;
  listeners: number;
  intervals: number;
  animationFrames: number;
  mutationObservers: number;
  requests: number;
  uploadBytes: number;
  preflights: number;
  longTasks: number;
}

export interface VendorResult {
  vendor: Vendor;
  size: { raw: number; gzip: number; brotli: number };
  samples: RunSample[];
}

export interface ReportRow {
  id: string;
  name: string;
  gzip: number;
  brotli: number;
  raw: number;
  loadMs: number;
  interactionMs: number;
  totalMs: number;
  heapKb: number;
  listeners: number;
  intervals: number;
  animationFrames: number;
  mutationObservers: number;
  requests: number;
  uploadBytes: number;
  preflights: number;
  longTasks: number;
}
