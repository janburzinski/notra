import { integrationsRouter } from "./routers/integrations";
import { reviewRouter } from "./routers/review";
import { sitesRouter } from "./routers/sites";

export const consoleRouter = {
  integrations: integrationsRouter,
  review: reviewRouter,
  sites: sitesRouter,
};

export type ConsoleRouter = typeof consoleRouter;
