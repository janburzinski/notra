import { Client as QStashClient } from "@upstash/qstash";

const RETIRED_ROUTE_PATH = "/api/workflows/iris";

const token = process.env.QSTASH_TOKEN;
if (!token) {
  throw new Error("QSTASH_TOKEN is not configured");
}

const client = new QStashClient({ token });
const schedules = await client.schedules.list();
const retired = schedules.filter((schedule) =>
  new URL(schedule.destination).pathname.endsWith(RETIRED_ROUTE_PATH)
);

await Promise.all(
  retired.map(async (schedule) => {
    await client.schedules.delete(schedule.scheduleId);
    console.log(
      `Deleted schedule ${schedule.scheduleId} -> ${schedule.destination}`
    );
  })
);

console.log(`Retired ${retired.length} Iris schedule(s)`);
process.exit(0);
