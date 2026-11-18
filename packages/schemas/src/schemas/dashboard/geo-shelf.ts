import "zod/compile";
import { geoOrganizationInputSchema } from "@notra/geo-core/schemas/geo-scope";
import { z } from "zod";

import {
  GEO_SHELF_FETCH_STATUSES,
  GEO_SHELF_NOTES_MAX_LENGTH,
  GEO_SHELF_OPPORTUNITY_STATUSES,
  GEO_SHELF_ORIGINS,
  GEO_SHELF_OFFSET_MAX,
  GEO_SHELF_OWNERSHIPS,
  GEO_SHELF_PAGE_SIZE_MAX,
  GEO_SHELF_PLACEMENT_EVIDENCES,
  GEO_SHELF_PLACEMENT_STATUSES,
  GEO_SHELF_PRIORITIES,
  GEO_SHELF_SEARCH_MAX_LENGTH,
  GEO_SHELF_SHELF_FILTERS,
  GEO_SHELF_SORT_DIRECTIONS,
  GEO_SHELF_SORT_KEYS,
  GEO_SHELF_SOURCE_KINDS,
  GEO_SHELF_TICKET_FILTERS,
  GEO_SHELF_TITLE_MAX_LENGTH,
  GEO_SHELF_URL_INVALID_MESSAGE,
  GEO_SHELF_URL_MAX_LENGTH,
  GEO_SHELF_URL_PROTOCOL_PATTERN,
} from "../../constants/dashboard/geo-shelf";
import { isAllowedShelfUrl } from "../../utils/dashboard/shelf-url";

export const geoShelfUrlSchema = z
  .url({
    protocol: GEO_SHELF_URL_PROTOCOL_PATTERN,
    hostname: z.regexes.domain,
    error: GEO_SHELF_URL_INVALID_MESSAGE,
  })
  .max(GEO_SHELF_URL_MAX_LENGTH)
  .refine(isAllowedShelfUrl, { error: GEO_SHELF_URL_INVALID_MESSAGE });

export const geoShelfSourceKindSchema = z.enum(GEO_SHELF_SOURCE_KINDS);
export const geoShelfOwnershipSchema = z.enum(GEO_SHELF_OWNERSHIPS);
export const geoShelfOriginSchema = z.enum(GEO_SHELF_ORIGINS);
export const geoShelfFetchStatusSchema = z.enum(GEO_SHELF_FETCH_STATUSES);
export const geoShelfPlacementStatusSchema = z.enum(
  GEO_SHELF_PLACEMENT_STATUSES
);
export const geoShelfPlacementEvidenceSchema = z.enum(
  GEO_SHELF_PLACEMENT_EVIDENCES
);
export const geoShelfOpportunityStatusSchema = z.enum(
  GEO_SHELF_OPPORTUNITY_STATUSES
);
export const geoShelfPrioritySchema = z.enum(GEO_SHELF_PRIORITIES);

export const geoShelfMemberSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string(),
});

export const geoShelfPlacementSchema = z.object({
  competitorId: z.string().min(1).nullable().meta({
    description:
      "Tracked competitor this placement is for, or `null` for your own brand.",
  }),
  brandName: z.string().min(1).meta({
    description: "Brand name at the time the placement was written.",
  }),
  brandDomain: z.string().nullable().meta({
    description:
      "Brand website domain at the time the placement was written. `null` when unknown.",
  }),
  status: geoShelfPlacementStatusSchema.meta({
    description:
      "present: the brand is listed on the page. absent: it is not. unknown: nobody has checked yet.",
  }),
  position: z.number().int().positive().nullable().meta({
    description:
      "1-based position of the brand on the page. `null` when unknown, and always `null` unless status is present.",
  }),
  hasLink: z.boolean().meta({
    description:
      "Whether the page links to the brand. Always false unless status is present.",
  }),
  evidence: geoShelfPlacementEvidenceSchema.meta({
    description:
      "manual: a teammate set the status. fetch: Notra read the page after a scan and found the brand there or not.",
  }),
  excerpt: z.string().nullable().meta({
    description:
      "Text from the page around the brand. `null` when none was captured.",
  }),
  checkedAt: z.iso.datetime().meta({
    description: "When this placement's status was last set.",
  }),
});

export const geoShelfCitationSummarySchema = z.object({
  windowCount: z.number().int().nonnegative().meta({
    description:
      "AI answers from the 30 days before the last citation sync that cited this page.",
  }),
  totalCount: z.number().int().nonnegative().meta({
    description: "AI answers that ever cited this page.",
  }),
  promptCount: z.number().int().nonnegative().meta({
    description: "Distinct prompts whose answers cited this page.",
  }),
  engines: z.array(z.string().min(1)).meta({
    description: "Engines that cited this page, sorted alphabetically.",
  }),
  firstCitedAt: z.iso.datetime().nullable().meta({
    description:
      "First answer that cited this page. `null` when no answer has cited it.",
  }),
  lastCitedAt: z.iso.datetime().nullable().meta({
    description:
      "Latest answer that cited this page. `null` when no answer has cited it.",
  }),
});

export const geoShelfOpportunityWriteSchema = z.object({
  status: geoShelfOpportunityStatusSchema.meta({
    description:
      "open or in_progress while the ticket is worked on. won, lost or dismissed close it.",
  }),
  priority: geoShelfPrioritySchema.nullable().meta({
    description: "low, medium or high. `null` when no priority is set.",
  }),
  assigneeMemberId: z.string().min(1).nullable().meta({
    description:
      "Organization member id (not user id) of the assignee. `null` when unassigned.",
  }),
  pocMemberId: z.string().min(1).nullable().meta({
    description:
      "Organization member id of the point of contact. `null` when the assignee is also the point of contact.",
  }),
  notes: z.string().max(GEO_SHELF_NOTES_MAX_LENGTH).nullable().meta({
    description: "Free-text notes on the ticket.",
  }),
  dueAt: z.iso.datetime().nullable().meta({
    description: "Due date. `null` when none is set.",
  }),
});

export const geoShelfOpportunitySchema = geoShelfOpportunityWriteSchema.extend({
  id: z.string().min(1).meta({ description: "Ticket id." }),
  createdByUserId: z.string().min(1).nullable().meta({
    description: "User who opened the ticket.",
  }),
  resolvedAt: z.iso.datetime().nullable().meta({
    description:
      "When the ticket was closed (won, lost or dismissed). Kept when it moves between closed statuses; `null` while open.",
  }),
  createdAt: z.iso.datetime().meta({
    description: "When the ticket was opened.",
  }),
  updatedAt: z.iso.datetime().meta({
    description: "When the ticket last changed.",
  }),
});

export const geoShelfSourceSchema = z.object({
  id: z.string().min(1).meta({ description: "Shelf source id." }),
  url: z.url().max(GEO_SHELF_URL_MAX_LENGTH).meta({
    description: "Page URL.",
  }),
  domain: z.string().min(1).meta({ description: "Hostname of the page." }),
  title: z.string().max(GEO_SHELF_TITLE_MAX_LENGTH).nullable().meta({
    description:
      "Page title, from a teammate or from the citations in AI answers. `null` when unknown.",
  }),
  kind: geoShelfSourceKindSchema.meta({
    description:
      "Type of page. For pages added by scans it is guessed from the domain, defaulting to other; teammates choose it for pages they add and can change it.",
  }),
  ownership: geoShelfOwnershipSchema.meta({
    description:
      "own: on your brand's website. competitor: on a tracked competitor's domain. third_party: anywhere else. Set when a scan adds the page; pages teammates add are third_party.",
  }),
  origin: geoShelfOriginSchema.meta({
    description:
      "scan: added automatically because AI answers cited it. manual: added by a teammate.",
  }),
  fetchStatus: geoShelfFetchStatusSchema.meta({
    description:
      "Whether Notra could read the page itself: pending, ok, blocked or failed. New sources start as pending.",
  }),
  lastFetchedAt: z.iso.datetime().nullable().meta({
    description: "When Notra last read the page. `null` if it never has.",
  }),
  citations: geoShelfCitationSummarySchema.meta({
    description:
      "How often AI answers for the project cited this page, as of the last citation sync.",
  }),
  placements: z.array(geoShelfPlacementSchema).meta({
    description:
      "Which brands are listed on the page. Your own brand is always included; a competitor appears only once marked present or absent.",
  }),
  opportunity: geoShelfOpportunitySchema.nullable().meta({
    description:
      "Ticket for getting your brand listed on this page. `null` when none was opened.",
  }),
  createdByUserId: z.string().min(1).nullable().meta({
    description: "User who added the page. `null` for pages added by scans.",
  }),
  createdAt: z.iso.datetime().meta({
    description:
      "For pages added by scans, when an answer first cited them; otherwise when a teammate added them.",
  }),
  updatedAt: z.iso.datetime().meta({
    description:
      "Last edit or citation change. Pages added by scans start with the time of their latest citation.",
  }),
});

const geoShelfCountSchema = z.number().int().nonnegative();

export const geoShelfBoardCountsSchema = z.object({
  untracked: geoShelfCountSchema,
  open: geoShelfCountSchema,
  in_progress: geoShelfCountSchema,
  won: geoShelfCountSchema,
  lost: geoShelfCountSchema,
  dismissed: geoShelfCountSchema,
});

export const geoShelfListResponseSchema = z.object({
  sources: z.array(geoShelfSourceSchema),
  /** Offset of the next page, `null` once every matching source is loaded. */
  nextOffset: geoShelfCountSchema.nullable(),
  /** Every source of the project, ignoring filters. */
  totalCount: geoShelfCountSchema,
  /** Sources matching the filters, across all pages. */
  filteredCount: geoShelfCountSchema,
  boardCounts: geoShelfBoardCountsSchema,
  hasScanData: z.boolean(),
  ownBrandName: z.string(),
  isSampleData: z.boolean(),
});

export const geoShelfMembersResponseSchema = z.object({
  members: z.array(geoShelfMemberSchema),
  currentMemberId: z.string().min(1).nullable(),
});

export const geoShelfMembersInputSchema = geoOrganizationInputSchema;

export const geoShelfListInputSchema = geoOrganizationInputSchema.extend({
  offset: z.number().int().nonnegative().max(GEO_SHELF_OFFSET_MAX).default(0),
  limit: z.number().int().positive().max(GEO_SHELF_PAGE_SIZE_MAX),
  search: z.string().max(GEO_SHELF_SEARCH_MAX_LENGTH).default(""),
  shelf: z.enum(GEO_SHELF_SHELF_FILTERS).default("all"),
  ticket: z.enum(GEO_SHELF_TICKET_FILTERS).default("any"),
  sortKey: z.enum(GEO_SHELF_SORT_KEYS).default("citations"),
  sortDirection: z.enum(GEO_SHELF_SORT_DIRECTIONS).default("desc"),
});

export const geoShelfPlacementWriteSchema = z.object({
  competitorId: z.string().min(1).nullable(),
  status: geoShelfPlacementStatusSchema,
});

export const geoShelfCreateInputSchema = geoOrganizationInputSchema.extend({
  url: geoShelfUrlSchema,
  title: z.string().trim().max(GEO_SHELF_TITLE_MAX_LENGTH).nullable(),
  kind: geoShelfSourceKindSchema,
  placements: z.array(geoShelfPlacementWriteSchema),
  opportunity: geoShelfOpportunityWriteSchema.nullable(),
});

export const geoShelfUpdateInputSchema = geoOrganizationInputSchema.extend({
  sourceId: z.string().min(1),
  title: z
    .string()
    .trim()
    .max(GEO_SHELF_TITLE_MAX_LENGTH)
    .nullable()
    .optional(),
  kind: geoShelfSourceKindSchema.optional(),
  placements: z.array(geoShelfPlacementWriteSchema).optional(),
  opportunity: geoShelfOpportunityWriteSchema.partial().nullable().optional(),
});

export const geoShelfMutationResponseSchema = z.object({
  source: geoShelfSourceSchema,
});

export const geoShelfPreviewInputSchema = geoOrganizationInputSchema.extend({
  url: geoShelfUrlSchema,
});

export const geoShelfPreviewResponseSchema = z.object({
  url: z.url(),
  finalUrl: z.url().nullable(),
  domain: z.string().min(1),
  title: z.string().max(GEO_SHELF_TITLE_MAX_LENGTH).nullable(),
  description: z.string().nullable(),
  available: z.boolean(),
});

export const geoShelfUrlCheckResponseSchema = z.object({
  onShelf: z.boolean(),
});
