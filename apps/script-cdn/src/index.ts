import { handleScriptRequest } from "./handler";

export default {
  fetch(request: Request): Response {
    return handleScriptRequest(request);
  },
} satisfies ExportedHandler;
