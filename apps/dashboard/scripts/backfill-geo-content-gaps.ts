import { db } from "@notra/db/drizzle";
import { geoContentGapSnapshots, geoSettings } from "@notra/db/schema";
import { refreshGeoContentGaps } from "@notra/geo-core/geo/gaps";
import { eq, isNull } from "drizzle-orm";
import { Effect } from "effect";

const query = db
  .select({
    organizationId: geoSettings.organizationId,
    projectId: geoSettings.projectId,
  })
  .from(geoSettings)
  .leftJoin(
    geoContentGapSnapshots,
    eq(geoContentGapSnapshots.projectId, geoSettings.projectId)
  );
const projects = process.argv.includes("--all")
  ? await query
  : await query.where(isNull(geoContentGapSnapshots.projectId));

let failed = 0;
for (const project of projects) {
  try {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- bound one-time backfill database work
    await Effect.runPromise(refreshGeoContentGaps(project));
    console.info(`Refreshed content gaps for ${project.projectId}`);
  } catch (error) {
    failed++;
    console.error(`Could not refresh ${project.projectId}:`, error);
  }
}
console.info(
  `Refreshed ${projects.length - failed} of ${projects.length} projects`
);
if (failed > 0) {
  process.exitCode = 1;
}
