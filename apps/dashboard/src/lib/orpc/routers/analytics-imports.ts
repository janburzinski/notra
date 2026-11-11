import {
  IMPORT_CSV_MAX_ZIP_BYTES,
  IMPORT_PROVIDERS,
} from "@notra/geo-core/constants/analytics-imports";
import { toImportSummary } from "@notra/geo-core/geo/analytics-imports";
import { describeImportError } from "@notra/geo-core/imports/http";
import {
  bytesToChunks,
  parsePlausibleCsvZip,
} from "@notra/geo-core/imports/plausible-csv";
import {
  ImportAuthError,
  ImportFileError,
  ImportProviderError,
  ImportRateLimitedError,
} from "@notra/geo-core/schemas/analytics-import-errors";
import type { ImportSourceProvider } from "@notra/geo-core/types/analytics-imports";
import {
  analyticsImportConnectionInputSchema,
  analyticsImportCsvInputSchema,
  analyticsImportSourceInputSchema,
  analyticsImportUploadInputSchema,
  connectAnalyticsImportInputSchema,
  deleteAnalyticsImportInputSchema,
  disconnectAnalyticsImportInputSchema,
  listAnalyticsImportsInputSchema,
} from "@notra/schemas/dashboard/analytics-imports";

import {
  ANALYTICS_IMPORT_FILE_ERROR_DATA,
  ANALYTICS_IMPORT_INLINE_MAX_BYTES,
  ANALYTICS_IMPORT_PROVIDER_BRANDS,
  ANALYTICS_IMPORT_PROVIDER_LABELS,
} from "@/constants/analytics-imports";
import { runAfterResponse } from "@/lib/after-response";
import {
  decryptImportCredentials,
  toImportCredentials,
} from "@/lib/analytics-imports/credentials";
import { hashExport } from "@/lib/analytics-imports/csv-ref";
import {
  AnalyticsImportInputError,
  createAnalyticsImport,
  deleteConnection,
  findConnection,
  findImportByUploadKey,
  listAnalyticsImports,
  listConnections,
  markConnectionReauth,
  markImportDeleting,
  planImportRange,
  projectBelongsTo,
  replaceConnectionCredentials,
  saveConnection,
  setImportWorkflowRun,
  summarizeImport,
  toConnectionSummary,
  toPreview,
} from "@/lib/analytics-imports/imports";
import {
  listImportSources,
  previewImportSource,
} from "@/lib/analytics-imports/providers";
import {
  deleteAnalyticsImportData,
  runAnalyticsImportInline,
} from "@/lib/analytics-imports/runner";
import {
  createImportUploadTarget,
  deleteImportUpload,
  isImportUploadKey,
  readImportUpload,
} from "@/lib/analytics-imports/storage";
import { assertGeoEntitlement } from "@/lib/billing/subscription";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import {
  assertNotDemo,
  badRequest,
  notFound,
  tooManyRequests,
} from "@/lib/orpc/utils/errors";
import { assertOrganizationManager } from "@/lib/orpc/utils/organization-manager";
import { isR2StorageConfigured } from "@/lib/upload/r2";
import {
  startAnalyticsImportDeleteRun,
  startAnalyticsImportRun,
} from "@/lib/workflows/start";
import type {
  AnalyticsImportConnectionRow,
  AnalyticsImportCredentials,
  AnalyticsImportSecretInput,
} from "@/types/analytics-imports";
import { isOrganizationManager } from "@/utils/organization-roles";
import { ratelimit } from "@/utils/ratelimit";

/** Provider failures become messages the connect and import screens can show. */
function toClientError(error: unknown): never {
  if (error instanceof AnalyticsImportInputError) {
    throw badRequest(error.message);
  }
  if (error instanceof ImportAuthError) {
    const brand =
      error.provider in ANALYTICS_IMPORT_PROVIDER_BRANDS
        ? ANALYTICS_IMPORT_PROVIDER_BRANDS[
            error.provider as keyof typeof ANALYTICS_IMPORT_PROVIDER_BRANDS
          ]
        : "The provider";
    const secret = error.provider === "plausible" ? "key" : "token";
    throw badRequest(
      `${brand} rejected this ${secret}. Check that it is valid and has read access to analytics.`
    );
  }
  if (error instanceof ImportRateLimitedError) {
    throw tooManyRequests(
      `The provider is rate limiting requests. Try again in ${error.retryAfterSeconds} seconds.`
    );
  }
  if (error instanceof ImportFileError) {
    throw badRequest(
      describeImportError(error),
      ANALYTICS_IMPORT_FILE_ERROR_DATA
    );
  }
  if (error instanceof ImportProviderError) {
    throw badRequest(describeImportError(error));
  }
  throw error;
}

/**
 * Caps how often one organization can validate tokens, start imports or ask
 * for upload URLs; each one reaches a provider or storage.
 */
async function assertImportRateLimit(
  action: "connect" | "create" | "upload",
  organizationId: string
) {
  const { success } = await ratelimit.analyticsImport.limit(
    `${action}:${organizationId}`
  );
  if (!success) {
    throw tooManyRequests("Too many import requests. Try again later.");
  }
}

async function assertProject(organizationId: string, projectId: string) {
  if (!(await projectBelongsTo(organizationId, projectId))) {
    throw notFound("Project not found");
  }
}

function parseImportCredentials(input: AnalyticsImportSecretInput) {
  try {
    return toImportCredentials(input);
  } catch {
    throw badRequest(
      "This key doesn't look right. Check that you copied all of it."
    );
  }
}

async function requireConnection(organizationId: string, connectionId: string) {
  const connection = await findConnection(organizationId, connectionId);
  if (!connection) {
    throw notFound("Connection not found");
  }
  return connection;
}

/** Reads through a saved connection; a rejected key flags it for reconnecting. */
async function readWithConnection<T>(
  connection: AnalyticsImportConnectionRow,
  read: (credentials: AnalyticsImportCredentials) => Promise<T>
): Promise<T> {
  try {
    return await read(
      decryptImportCredentials(connection.encryptedCredentials)
    );
  } catch (error) {
    if (error instanceof ImportAuthError) {
      await markConnectionReauth(connection.id, describeImportError(error));
    }
    throw error;
  }
}

/**
 * The connection plus what the provider reports about the chosen source. A
 * source is only read through a connection of its own provider.
 */
async function loadImportSource(
  organizationId: string,
  input: {
    connectionId: string;
    provider: ImportSourceProvider;
    sourceRef: string;
  }
) {
  const connection = await requireConnection(
    organizationId,
    input.connectionId
  );
  if (IMPORT_PROVIDERS[input.provider].connection !== connection.provider) {
    throw badRequest("This source isn't available on that connection");
  }
  const source = await readWithConnection(connection, (credentials) =>
    previewImportSource(
      credentials,
      connection.id,
      input.provider,
      input.sourceRef
    )
  );
  return { connection, source };
}

/** Purges in a durable run, or after the response when workflows are unavailable. */
async function scheduleImportDelete(importId: string) {
  await startAnalyticsImportDeleteRun({ importId }).catch(() =>
    runAfterResponse("Analytics import delete failed", () =>
      deleteAnalyticsImportData(importId)
    )
  );
}

async function startImport(importId: string) {
  try {
    const run = await startAnalyticsImportRun({ importId, generation: 0 });
    await setImportWorkflowRun(importId, run.runId);
  } catch (error) {
    await deleteAnalyticsImportData(importId);
    throw error;
  }
}

async function csvSource(
  organizationId: string,
  input: { uploadKey?: string; file?: Blob }
) {
  if (input.uploadKey) {
    if (!isImportUploadKey(organizationId, input.uploadKey)) {
      throw badRequest("Upload not found");
    }
    return { key: input.uploadKey, bytes: null };
  }
  if (!input.file) {
    throw badRequest("Upload your Plausible export ZIP");
  }
  // With object storage the export must go there; an inline upload would
  // be held in this request's memory.
  if (isR2StorageConfigured()) {
    throw badRequest("Upload the export to storage first");
  }
  if (input.file.size > ANALYTICS_IMPORT_INLINE_MAX_BYTES) {
    throw badRequest(
      "The export is too large to upload here",
      ANALYTICS_IMPORT_FILE_ERROR_DATA
    );
  }
  return { key: null, bytes: new Uint8Array(await input.file.arrayBuffer()) };
}

/**
 * Listing, deleting and disconnecting stay open without the web analytics
 * flag, so a workspace can always remove what it stored; everything that
 * starts or previews an import needs the flag.
 */
export const analyticsImportsRouter = {
  list: authorizedProcedure
    .input(listAnalyticsImportsInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { organizationId, membership } = context.auth;
      const [imports, connections] = await Promise.all([
        listAnalyticsImports(organizationId, input.projectId ?? null),
        listConnections(organizationId),
      ]);
      return {
        imports,
        connections,
        canManage: isOrganizationManager(membership.role),
      };
    }),

  connect: authorizedProcedure
    .input(connectAnalyticsImportInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const { organizationId } = context.auth;
      assertOrganizationManager(context.auth.membership, "connect accounts");
      await assertGeoEntitlement(organizationId, context.headers);
      await assertImportRateLimit("connect", organizationId);
      const credentials = parseImportCredentials(input);
      if (input.connectionId) {
        await requireConnection(organizationId, input.connectionId);
      }
      const sources = await listImportSources(
        credentials,
        `connect:${organizationId}`
      ).catch(toClientError);
      const connection = input.connectionId
        ? await replaceConnectionCredentials(
            organizationId,
            input.connectionId,
            credentials
          )
        : await saveConnection({
            organizationId,
            userId: context.user.id,
            label:
              input.label ||
              (credentials.provider === "vercel" && credentials.teamId) ||
              ANALYTICS_IMPORT_PROVIDER_LABELS[input.provider],
            credentials,
          });
      if (!connection) {
        throw badRequest("This key is for a different provider");
      }
      return { connection: toConnectionSummary(connection), sources };
    }),

  sources: authorizedProcedure
    .input(analyticsImportConnectionInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const connection = await requireConnection(
        context.auth.organizationId,
        input.connectionId
      );
      const sources = await readWithConnection(connection, (credentials) =>
        listImportSources(credentials, connection.id)
      ).catch(toClientError);
      return { connection: toConnectionSummary(connection), sources };
    }),

  preview: authorizedProcedure
    .input(analyticsImportSourceInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      const { organizationId } = context.auth;
      await assertProject(organizationId, input.projectId);
      try {
        const { source } = await loadImportSource(organizationId, input);
        const plan = await planImportRange({
          organizationId,
          projectId: input.projectId,
          provider: input.provider,
          sourceRef: input.sourceRef,
          host: input.host,
          requestedStart: input.startDay ?? null,
          requestedEnd: input.endDay ?? null,
          earliestDay: source.earliestDay,
        });
        return {
          preview: toPreview(input.provider, plan, {
            total: source.pageviews,
            counts: source.pageviewsByMonth,
          }),
        };
      } catch (error) {
        return toClientError(error);
      }
    }),

  create: authorizedProcedure
    .input(analyticsImportSourceInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const { organizationId } = context.auth;
      await assertGeoEntitlement(organizationId, context.headers);
      await assertProject(organizationId, input.projectId);
      await assertImportRateLimit("create", organizationId);
      try {
        const { connection, source } = await loadImportSource(
          organizationId,
          input
        );
        const row = await createAnalyticsImport({
          organizationId,
          projectId: input.projectId,
          userId: context.user.id,
          provider: input.provider,
          connectionId: connection.id,
          sourceRef: input.sourceRef,
          sourceLabel: input.sourceLabel,
          host: input.host,
          requestedStart: input.startDay ?? null,
          requestedEnd: input.endDay ?? null,
          earliestDay: source.earliestDay,
          overlap: input.overlap,
        });
        await startImport(row.id);
        return { import: await summarizeImport(row) };
      } catch (error) {
        return toClientError(error);
      }
    }),

  uploadTarget: authorizedProcedure
    .input(analyticsImportUploadInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      if (input.fileSize > IMPORT_CSV_MAX_ZIP_BYTES) {
        throw badRequest("The export is larger than 200 MB");
      }
      await assertImportRateLimit("upload", context.auth.organizationId);
      return {
        target: await createImportUploadTarget(
          context.auth.organizationId,
          input.fileSize
        ),
      };
    }),

  csv: authorizedProcedure
    .input(analyticsImportCsvInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const { organizationId } = context.auth;
      await assertGeoEntitlement(organizationId, context.headers);
      await assertProject(organizationId, input.projectId);
      const source = await csvSource(organizationId, input);
      // A retried start (its first response was lost) gets the same import.
      const owner =
        source.key && !input.previewOnly
          ? await findImportByUploadKey(organizationId, source.key)
          : null;
      if (owner) {
        return { preview: null, import: toImportSummary(owner) };
      }
      const chunks = () =>
        source.bytes
          ? bytesToChunks(source.bytes)
          : readImportUpload(source.key ?? "");
      let created = false;
      try {
        const content = hashExport(chunks());
        const summary = await parsePlausibleCsvZip(
          content.chunks,
          () => undefined
        );
        const sourceRef = content.ref();
        const plan = await planImportRange({
          organizationId,
          projectId: input.projectId,
          provider: "plausible_csv",
          sourceRef,
          host: input.host,
          requestedStart: summary.firstDay,
          requestedEnd: summary.lastDay,
          earliestDay: summary.firstDay,
        });
        const preview = toPreview("plausible_csv", plan, {
          total: summary.pageviews,
          counts: summary.pageviewsByDay,
        });
        if (input.previewOnly) {
          return { preview, import: null };
        }
        await assertImportRateLimit("create", organizationId);
        const row = await createAnalyticsImport({
          organizationId,
          projectId: input.projectId,
          userId: context.user.id,
          provider: "plausible_csv",
          connectionId: null,
          sourceRef,
          sourceLabel: input.host,
          host: input.host,
          requestedStart: summary.firstDay,
          requestedEnd: summary.lastDay,
          earliestDay: summary.firstDay,
          overlap: input.overlap,
          ...(source.key ? { uploadKey: source.key } : {}),
        });
        created = true;
        if (source.bytes) {
          const bytes = source.bytes;
          runAfterResponse("Inline analytics import failed", () =>
            runAnalyticsImportInline(row.id, bytes)
          );
        } else {
          await startImport(row.id);
        }
        return { preview, import: toImportSummary(row) };
      } catch (error) {
        // An import owns its upload and deletes it; otherwise nothing will.
        if (
          source.key &&
          !created &&
          !(await findImportByUploadKey(organizationId, source.key))
        ) {
          await deleteImportUpload(source.key).catch(() => undefined);
        }
        return toClientError(error);
      }
    }),

  delete: authorizedProcedure
    .input(deleteAnalyticsImportInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      assertOrganizationManager(context.auth.membership, "delete imports");
      const row = await markImportDeleting(
        context.auth.organizationId,
        input.importId
      );
      if (!row) {
        throw notFound("Import not found");
      }
      await scheduleImportDelete(row.id);
      return { ok: true as const };
    }),

  disconnect: authorizedProcedure
    .input(disconnectAnalyticsImportInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const { organizationId } = context.auth;
      assertOrganizationManager(context.auth.membership, "disconnect accounts");
      const connection = await requireConnection(
        organizationId,
        input.connectionId
      );
      const imports = await deleteConnection(organizationId, connection.id);
      if (input.deleteImports) {
        await Promise.all(
          imports.map(async (row) => {
            await markImportDeleting(organizationId, row.id);
            await scheduleImportDelete(row.id);
          })
        );
      }
      return { ok: true as const };
    }),
};
