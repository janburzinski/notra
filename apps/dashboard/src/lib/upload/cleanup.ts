import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { purgeOrganizationChatData } from "@notra/ai/chat/history";
import { log } from "@notra/ai/evlog";
import { db } from "@notra/db/drizzle";
import { chatAttachments } from "@notra/db/schema";
import { inArray } from "drizzle-orm";

import { deleteR2Keys, getR2Config } from "./r2";

const TRAILING_SLASH_REGEX = /\/$/;

async function deleteObjectsByPrefix(prefix: string) {
  let totalDeleted = 0;
  let continuationToken: string | undefined;
  const { client: r2, bucketName } = getR2Config();

  do {
    const listResult = await r2.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const keys = (listResult.Contents ?? [])
      .map((obj) => obj.Key)
      .filter((key): key is string => key != null);
    totalDeleted += await deleteR2Keys(keys);

    continuationToken = listResult.NextContinuationToken;
  } while (continuationToken);

  return totalDeleted;
}

export async function deleteUserFiles(userId: string) {
  const prefix = `user/${userId}/`;
  try {
    const deleted = await deleteObjectsByPrefix(prefix);
    if (deleted > 0) {
      log.info({ event: "upload.cleanup.user", userId, deleted });
    }
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({
      event: "upload.cleanup.user.failed",
      userId,
      error: message,
    });
    throw error;
  }
}

/**
 * Never throws: the user row is already gone, so a failure is logged with the
 * keys rather than failing the account deletion.
 */
export async function deleteUserChatAttachmentObjects(
  userId: string,
  keys: string[]
) {
  if (keys.length === 0) {
    return 0;
  }
  try {
    const deleted = await deleteR2Keys(keys);
    log.info({ event: "upload.cleanup.user_chat", userId, deleted });
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({
      event: "upload.cleanup.user_chat.failed",
      userId,
      keys,
      error: message,
    });
    return 0;
  }
}

function extractKeyFromPublicUrl(
  url: string,
  publicUrl: string
): string | null {
  const normalizedPublicUrl = publicUrl.replace(TRAILING_SLASH_REGEX, "");
  const prefix = `${normalizedPublicUrl}/`;
  if (!url.startsWith(prefix)) {
    return null;
  }
  return url.slice(prefix.length);
}

export async function deleteOrganizationChatFiles(organizationId: string) {
  try {
    const { fileUrls } = await purgeOrganizationChatData(organizationId);
    const { publicUrl } = getR2Config();
    const keys = Array.from(
      new Set(
        fileUrls
          .map((url) => extractKeyFromPublicUrl(url, publicUrl))
          .filter((key): key is string => key !== null)
      )
    );
    const deleted = await deleteR2Keys(keys);

    if (keys.length > 0) {
      await db
        .delete(chatAttachments)
        .where(inArray(chatAttachments.key, keys));
    }

    if (deleted > 0) {
      log.info({
        event: "upload.cleanup.org_chat",
        organizationId,
        deleted,
      });
    }
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({
      event: "upload.cleanup.org_chat.failed",
      organizationId,
      error: message,
    });
    throw error;
  }
}

export async function deleteOrganizationFiles(organizationId: string) {
  const prefix = `organization/${organizationId}/`;
  try {
    const deleted = await deleteObjectsByPrefix(prefix);
    if (deleted > 0) {
      log.info({ event: "upload.cleanup.org", organizationId, deleted });
    }
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({
      event: "upload.cleanup.org.failed",
      organizationId,
      error: message,
    });
    throw error;
  }
}
