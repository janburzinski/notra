import {
  CACHE_RESULTS,
  ENVIRONMENTS,
  FUNCTION_START_TYPES,
  MAX_METADATA_LENGTH,
  REQUEST_METHODS,
} from "../constants/metrics.ts";

export function dimensionValue(name: string, value: unknown): string | number {
  if (value == null) {
    return "unattributed";
  }
  if (value === "") {
    return "";
  }
  if (name === "httpStatus") {
    if (
      (typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 100 &&
        value <= 599) ||
      (typeof value === "string" && /^[1-5][0-9]{2}$/.test(value))
    ) {
      return value;
    }
  } else if (typeof value === "string" && value.length <= MAX_METADATA_LENGTH) {
    switch (name) {
      case "projectId":
        if (/^prj_[a-zA-Z0-9]+$/.test(value)) {
          return value;
        }
        break;
      case "environment":
        if (ENVIRONMENTS.includes(value)) {
          return value;
        }
        break;
      case "requestMethod":
        if (REQUEST_METHODS.includes(value)) {
          return value;
        }
        break;
      case "cacheResult":
        if (CACHE_RESULTS.includes(value)) {
          return value;
        }
        break;
      case "runtime":
        if (/^(nodejs[1-9][0-9]?\.x|python3\.[1-9][0-9]?|edge)$/.test(value)) {
          return value;
        }
        break;
      case "functionStartType":
        if (FUNCTION_START_TYPES.includes(value)) {
          return value;
        }
        break;
      default:
        break;
    }
  }
  throw new Error("invalid_dimension");
}
