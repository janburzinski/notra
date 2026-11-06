import { createServerFn } from "@tanstack/react-start";

import { loadDataSnapshot } from "@/lib/data/snapshot";
import { buildDataPage } from "@/utils/data";

/** The /data page model, trimmed on the server to what the page renders. */
export const getDataPage = createServerFn({ method: "GET" }).handler(async () =>
  buildDataPage(await loadDataSnapshot())
);
