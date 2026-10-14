import {
  MAX_CATALOG_PAGE_ITEMS,
  MAX_DIMENSION_NAMES,
  MAX_METADATA_LENGTH,
  METRIC_AGGREGATIONS,
  METRIC_ID_PATTERN,
  METRIC_UNITS,
  SERIES_LIMIT,
  SYSTEM_EVENT_PATTERN,
} from "../constants/metrics.ts";
import type { CatalogPage, MetricSummary } from "../types/metrics.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_METADATA_LENGTH;
}

function isStringArray(value: unknown, limit: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= limit &&
    value.every(isBoundedString)
  );
}

export function catalogPage(value: unknown): CatalogPage {
  if (!isRecord(value) || !Array.isArray(value.metrics)) {
    throw new Error("invalid_catalog");
  }
  if (value.metrics.length > MAX_CATALOG_PAGE_ITEMS) {
    throw new Error("catalog_page_limit");
  }
  const metrics = value.metrics.map((metric: unknown) => {
    if (
      !isRecord(metric) ||
      !isBoundedString(metric.id) ||
      !METRIC_ID_PATTERN.test(metric.id) ||
      !isBoundedString(metric.unit) ||
      !METRIC_UNITS.includes(metric.unit.toLowerCase()) ||
      !isStringArray(metric.aggregations, METRIC_AGGREGATIONS.length) ||
      metric.aggregations.length === 0 ||
      !metric.aggregations.every((item) =>
        METRIC_AGGREGATIONS.includes(item)
      ) ||
      !isStringArray(metric.dimensions, MAX_DIMENSION_NAMES) ||
      !metric.dimensions.every((item) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(item)) ||
      !isRecord(metric.derivedFrom) ||
      !isBoundedString(metric.derivedFrom.event) ||
      !SYSTEM_EVENT_PATTERN.test(metric.derivedFrom.event)
    ) {
      throw new Error("invalid_catalog");
    }
    return {
      id: metric.id,
      unit: metric.unit,
      aggregations: metric.aggregations,
      dimensions: metric.dimensions,
      derivedFrom: { event: metric.derivedFrom.event },
    };
  });
  if (value.pagination === undefined) {
    return { metrics };
  }
  if (
    !isRecord(value.pagination) ||
    typeof value.pagination.hasMore !== "boolean" ||
    (value.pagination.nextCursor != null &&
      !isBoundedString(value.pagination.nextCursor))
  ) {
    throw new Error("invalid_catalog");
  }
  return {
    metrics,
    pagination: {
      hasMore: value.pagination.hasMore,
      nextCursor:
        typeof value.pagination.nextCursor === "string"
          ? value.pagination.nextCursor
          : undefined,
    },
  };
}

export function metricSummary(value: unknown): MetricSummary[] {
  if (!isRecord(value) || !Array.isArray(value.summary)) {
    throw new Error("invalid_response");
  }
  if (value.summary.length >= SERIES_LIMIT) {
    throw new Error("series_limit");
  }
  return value.summary.map((row: unknown) => {
    if (
      !isRecord(row) ||
      !isRecord(row.values) ||
      (row.dimensions != null && !isRecord(row.dimensions))
    ) {
      throw new Error("invalid_response");
    }
    return {
      values: row.values,
      dimensions: isRecord(row.dimensions) ? row.dimensions : {},
    };
  });
}
