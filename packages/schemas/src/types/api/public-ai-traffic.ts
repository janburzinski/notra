import type * as z from "zod";

import type {
  publicAiTrafficChartSchema,
  publicAiTrafficPurposeSchema,
  publicAiTrafficSnapshotSchema,
  publicAiTrafficSourceSchema,
  publicAiTrafficVendorSchema,
} from "../../schemas/api/public-ai-traffic";

export type PublicAiTrafficSource = z.infer<typeof publicAiTrafficSourceSchema>;
export type PublicAiTrafficPurpose = z.infer<
  typeof publicAiTrafficPurposeSchema
>;
export type PublicAiTrafficVendor = z.infer<typeof publicAiTrafficVendorSchema>;
export type PublicAiTrafficChart = z.infer<typeof publicAiTrafficChartSchema>;
export type PublicAiTrafficSnapshot = z.infer<
  typeof publicAiTrafficSnapshotSchema
>;
