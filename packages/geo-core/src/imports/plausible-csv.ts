import { Unzip, UnzipInflate, type UnzipFile } from "fflate";

import {
  IMPORT_CSV_MAX_COMPRESSION_RATIO,
  IMPORT_CSV_MAX_ENTRIES,
  IMPORT_CSV_MAX_FIELD_LENGTH,
  IMPORT_CSV_MAX_ROW_CELLS,
  IMPORT_CSV_MAX_ROW_LENGTH,
  IMPORT_CSV_MAX_UNCOMPRESSED_BYTES,
  IMPORT_CSV_RATIO_MIN_BYTES,
  IMPORT_CSV_ZIP_SLICE_BYTES,
  PLAUSIBLE_CSV_FILE_PATTERN,
  PLAUSIBLE_CSV_IGNORED_TABLES,
  PLAUSIBLE_CSV_TABLES,
} from "../constants/analytics-imports";
import { ImportFileError } from "../schemas/analytics-import-errors";
import type {
  PlausibleCsvSummary,
  PlausibleCsvTable,
  WebImportRecord,
} from "../types/analytics-imports";
import { createCsvStreamParser } from "../utils/csv-stream";
import { readImportDimensions } from "./map-dimensions";

type PlausibleTable = keyof typeof PLAUSIBLE_CSV_TABLES;

const DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const COUNT_REGEX = /^\d+$/;
const BATCH_SIZE = 5000;

function isTable(name: string): name is PlausibleTable {
  return name in PLAUSIBLE_CSV_TABLES;
}

function toRecord(
  table: PlausibleCsvTable,
  read: (column: string) => string,
  readCount: (column: string) => number
): WebImportRecord {
  const record: WebImportRecord = {
    grain: table.grain,
    day: read("date"),
    ...readImportDimensions(table.dimensions, read),
  };
  for (const [column, metric] of table.counts) {
    record[metric] = readCount(column);
  }
  return record;
}

/** Parses one CSV file of a Plausible export; returns a sink for its decoded text. */
function createFileParser(
  file: string,
  table: PlausibleTable,
  emit: (record: WebImportRecord) => void
) {
  const parser = createCsvStreamParser(",", {
    maxFieldLength: IMPORT_CSV_MAX_FIELD_LENGTH,
    maxRowCells: IMPORT_CSV_MAX_ROW_CELLS,
    maxRowLength: IMPORT_CSV_MAX_ROW_LENGTH,
  });
  let columns: Map<string, number> | null = null;
  let line = 0;

  function handle(cells: string[]) {
    line += 1;
    if (!columns) {
      const header = cells.map((cell, index) =>
        (index === 0 ? cell.replace(/^\uFEFF/, "") : cell).trim().toLowerCase()
      );
      const missing = PLAUSIBLE_CSV_TABLES[table].columns.filter(
        (column) => !header.includes(column)
      );
      if (missing.length > 0) {
        throw new ImportFileError({
          file,
          detail: `missing columns: ${missing.join(", ")}`,
        });
      }
      columns = new Map(header.map((column, index) => [column, index]));
      return;
    }
    const index = columns;
    const read = (column: string) => cells[index.get(column) ?? -1] ?? "";
    const readCount = (column: string) => {
      const value = read(column).trim();
      if (value === "") {
        return 0;
      }
      if (!COUNT_REGEX.test(value)) {
        throw new ImportFileError({
          file,
          detail: `line ${line}: ${column} is not a count`,
        });
      }
      return Number(value);
    };
    if (!DAY_REGEX.test(read("date"))) {
      throw new ImportFileError({ file, detail: `line ${line}: invalid date` });
    }
    emit(toRecord(PLAUSIBLE_CSV_TABLES[table], read, readCount));
  }

  // The parser's limits name the line; report them as a broken file.
  const parse = (read: () => string[][]) => {
    let records: string[][];
    try {
      records = read();
    } catch (error) {
      if (error instanceof RangeError) {
        throw new ImportFileError({ file, detail: error.message });
      }
      throw error;
    }
    for (const cells of records) {
      handle(cells);
    }
  };

  return {
    feed(text: string) {
      parse(() => parser.feed(text));
    },
    end() {
      parse(() => parser.end());
      if (!columns) {
        throw new ImportFileError({ file, detail: "empty file" });
      }
    },
  };
}

/**
 * Why an entry's declared sizes rule it out before anything is inflated:
 * larger than the whole export may be, or compressed far beyond what CSV
 * allows. Null when it may be read, or when it declares no sizes.
 */
function declaredSizeProblem(file: UnzipFile): string | null {
  const { originalSize, size } = file;
  if (originalSize === undefined) {
    return null;
  }
  if (originalSize > IMPORT_CSV_MAX_UNCOMPRESSED_BYTES) {
    return "export too large";
  }
  if (
    originalSize > IMPORT_CSV_RATIO_MIN_BYTES &&
    originalSize > (size ?? 0) * IMPORT_CSV_MAX_COMPRESSION_RATIO
  ) {
    return "compressed too far";
  }
  return null;
}

/**
 * Streams a Plausible "Export to CSV" ZIP: unzips, parses and hands over
 * records in batches without holding the export in memory. Only aggregate
 * columns are read; regions, cities, exit pages and custom events are skipped.
 */
export async function parsePlausibleCsvZip(
  chunks: AsyncIterable<Uint8Array>,
  onRecords: (records: WebImportRecord[]) => Promise<void> | void
): Promise<PlausibleCsvSummary> {
  const summary: PlausibleCsvSummary = {
    firstDay: null,
    lastDay: null,
    pageviews: 0,
    pageviewsByDay: {},
    files: [],
    recordsByDay: {},
  };
  let pending: WebImportRecord[] = [];
  let failure: unknown = null;
  let uncompressed = 0;
  let compressed = 0;
  let entries = 0;
  let open = 0;
  const started: UnzipFile[] = [];
  const fail = (error: unknown) => {
    failure ??= error;
    for (const file of started) {
      file.terminate();
    }
  };

  const emit = (record: WebImportRecord) => {
    summary.recordsByDay[record.day] =
      (summary.recordsByDay[record.day] ?? 0) + 1;
    if (record.grain === "total") {
      summary.pageviews += record.pageviews ?? 0;
      summary.pageviewsByDay[record.day] =
        (summary.pageviewsByDay[record.day] ?? 0) + (record.pageviews ?? 0);
      if (!summary.firstDay || record.day < summary.firstDay) {
        summary.firstDay = record.day;
      }
      if (!summary.lastDay || record.day > summary.lastDay) {
        summary.lastDay = record.day;
      }
    }
    pending.push(record);
  };

  const unzip = new Unzip((file: UnzipFile) => {
    const name = file.name.split("/").at(-1) ?? file.name;
    if (failure || file.name.endsWith("/")) {
      return;
    }
    entries += 1;
    if (entries > IMPORT_CSV_MAX_ENTRIES) {
      fail(
        new ImportFileError({
          file: "export.zip",
          detail: `more than ${IMPORT_CSV_MAX_ENTRIES} files`,
        })
      );
      return;
    }
    if (name.startsWith(".")) {
      return;
    }
    const match = PLAUSIBLE_CSV_FILE_PATTERN.exec(name);
    const table = match?.[1] ?? "";
    if ((PLAUSIBLE_CSV_IGNORED_TABLES as readonly string[]).includes(table)) {
      return;
    }
    if (!isTable(table)) {
      fail(
        new ImportFileError({
          file: name,
          detail: "not a file from Plausible's CSV export",
        })
      );
      return;
    }
    const declared = declaredSizeProblem(file);
    if (declared) {
      fail(new ImportFileError({ file: name, detail: declared }));
      return;
    }
    summary.files.push(name);
    const decoder = new TextDecoder();
    const parser = createFileParser(name, table, emit);
    open += 1;
    file.ondata = (error, data, final) => {
      if (failure) {
        return;
      }
      try {
        if (error) {
          throw new ImportFileError({ file: name, detail: error.message });
        }
        uncompressed += data.length;
        if (uncompressed > IMPORT_CSV_MAX_UNCOMPRESSED_BYTES) {
          throw new ImportFileError({ file: name, detail: "export too large" });
        }
        // Entries written as a stream declare no sizes; check as they inflate.
        if (
          uncompressed > IMPORT_CSV_RATIO_MIN_BYTES &&
          uncompressed > compressed * IMPORT_CSV_MAX_COMPRESSION_RATIO
        ) {
          throw new ImportFileError({
            file: name,
            detail: "compressed too far",
          });
        }
        parser.feed(decoder.decode(data, { stream: !final }));
        if (final) {
          parser.end();
          open -= 1;
        }
      } catch (error_) {
        fail(error_);
      }
    };
    started.push(file);
    file.start();
  });
  unzip.register(UnzipInflate);

  const flush = async () => {
    if (failure) {
      throw failure;
    }
    const records = pending;
    pending = [];
    for (let index = 0; index < records.length; index += BATCH_SIZE) {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- batches are written in order to bound memory
      await onRecords(records.slice(index, index + BATCH_SIZE));
    }
  };

  for await (const chunk of chunks) {
    for (
      let offset = 0;
      offset < chunk.length;
      offset += IMPORT_CSV_ZIP_SLICE_BYTES
    ) {
      const slice = chunk.subarray(offset, offset + IMPORT_CSV_ZIP_SLICE_BYTES);
      compressed += slice.length;
      unzip.push(slice);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each slice's records are written before the next inflates
      await flush();
    }
  }
  unzip.push(new Uint8Array(0), true);
  await flush();
  if (summary.files.length === 0) {
    throw new ImportFileError({
      file: "export.zip",
      detail: "no imported_*.csv files found",
    });
  }
  if (open > 0) {
    throw new ImportFileError({ file: "export.zip", detail: "truncated ZIP" });
  }
  return summary;
}

export async function* bytesToChunks(
  bytes: Uint8Array,
  size = IMPORT_CSV_ZIP_SLICE_BYTES
): AsyncGenerator<Uint8Array> {
  for (let offset = 0; offset < bytes.length; offset += size) {
    yield bytes.subarray(offset, offset + size);
  }
}
