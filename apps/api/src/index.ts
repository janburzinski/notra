import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";

const app = new Hono({ strict: true });

app.use(trimTrailingSlash({ alwaysRedirect: true }));

app.get("/", (c) => {
  return c.text("Something big is coming...");
});

export default {
  port: 3004,
  fetch: app.fetch,
};
