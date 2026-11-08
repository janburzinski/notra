import type { CsvStreamLimits, CsvStreamParser } from "../types/csv";

const QUOTE = '"';

const UNLIMITED: CsvStreamLimits = {
  maxFieldLength: Number.POSITIVE_INFINITY,
  maxRowCells: Number.POSITIVE_INFINITY,
  maxRowLength: Number.POSITIVE_INFINITY,
};

/**
 * Incremental RFC 4180 parser: feed decoded text in any chunk size and get
 * back every record completed so far. Quoted fields may span chunks. With
 * limits, an oversized field or row throws a `RangeError` naming its line
 * before it can grow further, so an unterminated quote cannot buffer the
 * rest of the file.
 */
export function createCsvStreamParser(
  delimiter = ",",
  limits: CsvStreamLimits = UNLIMITED
): CsvStreamParser {
  let field = "";
  let row: string[] = [];
  let rowLength = 0;
  let rowsDone = 0;
  let inQuotes = false;
  let quotePending = false;
  let sawContent = false;

  /** Names the record's 1-based line, counting every record before it. */
  function tooLarge(problem: string) {
    return new RangeError(`line ${rowsDone + 1}: ${problem}`);
  }

  function append(char: string) {
    field += char;
    rowLength += char.length;
    if (field.length > limits.maxFieldLength) {
      throw tooLarge(`a field is longer than ${limits.maxFieldLength}`);
    }
    if (rowLength > limits.maxRowLength) {
      throw tooLarge(`a row is longer than ${limits.maxRowLength}`);
    }
  }

  function pushField() {
    row.push(field);
    field = "";
    if (row.length > limits.maxRowCells) {
      throw tooLarge(`a row has more than ${limits.maxRowCells} cells`);
    }
  }

  function endRow(records: string[][]) {
    const empty = !sawContent && row.length === 0 && field === "";
    pushField();
    if (!empty) {
      records.push(row);
    }
    row = [];
    rowLength = 0;
    rowsDone += 1;
    sawContent = false;
  }

  function feed(text: string): string[][] {
    const records: string[][] = [];
    for (const char of text) {
      if (quotePending) {
        quotePending = false;
        if (char === QUOTE) {
          append(QUOTE);
          continue;
        }
        inQuotes = false;
      }
      if (inQuotes) {
        if (char === QUOTE) {
          quotePending = true;
        } else {
          append(char);
        }
        continue;
      }
      if (char === QUOTE) {
        inQuotes = true;
        sawContent = true;
      } else if (char === delimiter) {
        pushField();
        sawContent = true;
      } else if (char === "\n") {
        endRow(records);
      } else if (char !== "\r") {
        append(char);
        sawContent = true;
      }
    }
    return records;
  }

  function end(): string[][] {
    const records: string[][] = [];
    if (quotePending) {
      quotePending = false;
      inQuotes = false;
    }
    if (sawContent || field !== "" || row.length > 0) {
      endRow(records);
    }
    return records;
  }

  return { feed, end };
}
