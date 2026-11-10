import { expect, test } from "bun:test";

import { organizations } from "@notra/db/schema";
import {
  TRACKER_PLUS_RELEASE,
  TRACKER_RELEASE,
} from "@notra/web-tracker/release";
import { Effect, Exit } from "effect";

import { geoWebScriptTag } from "../src/utils/web-script-tag";
import {
  isIsolatedTestWorker,
  testInIsolatedProcess,
} from "./utils/isolated-process";

if (!isIsolatedTestWorker(import.meta.url)) {
  testInIsolatedProcess(
    "web keys are always issued, read and rotated per project",
    import.meta.url
  );
} else {
  process.env.GEO_INGEST_SECRET = "web-key-setup-secret";
  process.env.GEO_INGEST_URL = "https://ingest.example";
  await import("./utils/infrastructure");
  const { database, initializeDatabase, seedProject, testDb } =
    await import("./utils/database");
  const {
    issueGeoIngestSetupResponse,
    loadGeoWebSetupResponse,
    rotateGeoIngestSetupResponse,
    rotateGeoWebKeySetupResponse,
    verifyGeoWebKey,
  } = await import("../src/geo/ingest");

  const webProject = (key: string | undefined) =>
    verifyGeoWebKey(key ?? "")?.projectId;

  test("setup without a project uses the oldest project's key", async () => {
    await initializeDatabase();
    try {
      const oldest = await seedProject("proj-oldest", {
        organizationId: "org-web",
      });
      const sibling = await seedProject("proj-sibling", {
        organizationId: "org-web",
      });
      const organization = { organizationId: "org-web" };

      const read = await Effect.runPromise(
        loadGeoWebSetupResponse(organization)
      );
      const issued = await Effect.runPromise(
        issueGeoIngestSetupResponse(organization)
      );
      const rotated = await Effect.runPromise(
        rotateGeoIngestSetupResponse(organization)
      );
      if (!(issued?.webKey && issued.webScript)) {
        throw new Error("Expected a web setup for the oldest project");
      }
      expect(read).not.toHaveProperty("token");
      expect(webProject(read.webKey)).toBe(oldest.projectId);
      expect(webProject(issued.webKey)).toBe(oldest.projectId);
      expect(webProject(rotated?.webKey)).toBe(oldest.projectId);
      expect(
        webProject(
          (await Effect.runPromise(issueGeoIngestSetupResponse(sibling)))
            ?.webKey
        )
      ).toBe(sibling.projectId);

      // Both builds are served from the ingest origin, auto-updating and pinned.
      expect(issued.webScript).toEqual({
        url: "https://ingest.example/api/notra.js",
        pinnedUrl: `https://ingest.example/api/${TRACKER_RELEASE.file}`,
        integrity: TRACKER_RELEASE.integrity,
      });
      expect(issued.webPlusScript).toEqual({
        url: "https://ingest.example/api/notra.plus.js",
        pinnedUrl: `https://ingest.example/api/${TRACKER_PLUS_RELEASE.file}`,
        integrity: TRACKER_PLUS_RELEASE.integrity,
      });
      // The returned tag is the pinned build with its integrity hash.
      expect(issued.webSnippet).toBe(
        geoWebScriptTag(issued.webKey, issued.webScript)
      );
      expect(issued.webSnippet).toContain(
        `src="https://ingest.example/api/${TRACKER_RELEASE.file}"`
      );
      expect(issued.webSnippet).toContain(
        `integrity="${TRACKER_RELEASE.integrity}" crossorigin="anonymous"`
      );

      // With a script host, builds load from it and page views go to the ingest.
      process.env.GEO_SCRIPT_URL = "https://js.example";
      try {
        const hosted = await Effect.runPromise(
          loadGeoWebSetupResponse(organization)
        );
        expect(hosted.webScript).toEqual({
          url: "https://js.example/notra.js",
          pinnedUrl: `https://js.example/${TRACKER_RELEASE.file}`,
          integrity: TRACKER_RELEASE.integrity,
          collectUrl: "https://ingest.example/api/collect",
        });
        expect(hosted.webPlusScript?.url).toBe(
          "https://js.example/notra.plus.js"
        );
        expect(hosted.webSnippet).toContain(
          'data-api="https://ingest.example/api/collect"'
        );
      } finally {
        delete process.env.GEO_SCRIPT_URL;
      }

      const withoutWeb = await Effect.runPromise(
        issueGeoIngestSetupResponse(sibling, false)
      );
      expect(withoutWeb?.token).toBeTruthy();
      expect(withoutWeb).not.toHaveProperty("webKey");
      expect(withoutWeb).not.toHaveProperty("webScript");

      const siblingKey = (
        await Effect.runPromise(loadGeoWebSetupResponse(sibling))
      ).webKey;
      await Effect.runPromise(rotateGeoWebKeySetupResponse(organization));
      expect(
        verifyGeoWebKey(
          (await Effect.runPromise(loadGeoWebSetupResponse(organization)))
            .webKey ?? ""
        )
      ).toMatchObject({ projectId: oldest.projectId, generation: 1 });
      expect(
        (await Effect.runPromise(loadGeoWebSetupResponse(sibling))).webKey
      ).toBe(siblingKey);

      await testDb.insert(organizations).values({
        id: "org-empty",
        name: "org-empty",
        slug: "org-empty",
        createdAt: new Date(),
      });
      const empty = { organizationId: "org-empty" };
      const emptyRead = await Effect.runPromise(loadGeoWebSetupResponse(empty));
      const emptyIssued = await Effect.runPromise(
        issueGeoIngestSetupResponse(empty)
      );
      expect(emptyRead.webKey).toBeUndefined();
      expect(emptyIssued?.token).toBeTruthy();
      expect(emptyIssued?.webKey).toBeUndefined();
      expect(emptyIssued?.webSnippet).toBeUndefined();
      const emptyRotate = await Effect.runPromiseExit(
        rotateGeoWebKeySetupResponse(empty)
      );
      expect(Exit.isFailure(emptyRotate)).toBe(true);
    } finally {
      await database.postgres.close();
    }
  });
}
