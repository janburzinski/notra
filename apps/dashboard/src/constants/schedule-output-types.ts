import type { ScheduleOutputType } from "@notra/schemas/dashboard/integrations";

const AUTO_PUBLISH_SUPPORTED = new Set<string>([
  "changelog",
  "blog_post",
] satisfies ScheduleOutputType[]);

export function supportsAutoPublish(outputType: string): boolean {
  return AUTO_PUBLISH_SUPPORTED.has(outputType);
}
