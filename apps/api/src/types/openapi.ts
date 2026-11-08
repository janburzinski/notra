import type { OPENAPI_HTTP_METHODS } from "../constants/openapi";

type OpenApiHttpMethod = (typeof OPENAPI_HTTP_METHODS)[number];

/** The parts of an OpenAPI operation the API rewrites after generating it. */
interface OpenApiOperationText {
  summary?: string;
  description?: string;
}

export interface OpenApiDocumentPaths {
  paths?: Record<
    string,
    Partial<Record<OpenApiHttpMethod, OpenApiOperationText>> | undefined
  >;
}
