export interface CsvRecord {
  line: number;
  cells: string[];
}

export interface CsvDocument {
  delimiter: string;
  header: string[];
  records: CsvRecord[];
}

export interface CsvStreamParser {
  /** Returns the records completed by this chunk. */
  feed(text: string): string[][];
  /** Flushes a final record without a trailing newline. */
  end(): string[][];
}

/** Limits after which the parser throws a `RangeError`. */
export interface CsvStreamLimits {
  maxFieldLength: number;
  maxRowCells: number;
  maxRowLength: number;
}
