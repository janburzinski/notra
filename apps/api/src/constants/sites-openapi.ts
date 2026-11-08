import { errorResponse } from "../utils/openapi-responses";

export const SITES_ERROR_RESPONSES = {
  400: errorResponse("Invalid request"),
  401: errorResponse("Missing or invalid API key"),
  402: errorResponse("Plan limit reached"),
  403: errorResponse("Forbidden or missing the sites scope"),
  404: errorResponse("Organization, Site, deployment or post not found"),
  409: errorResponse("Conflict"),
  429: errorResponse("Too many requests"),
  502: errorResponse("Sites request failed"),
  503: errorResponse("Notra Sites is not available"),
  504: errorResponse("Request timed out and may still complete"),
};
