import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "@notra/db/drizzle";
import { members } from "@notra/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { assertAuthenticated } from "@/lib/auth/organization";
import { validateUpload } from "@/schemas/upload";
import type {
  UploadPresignedResponse,
  UploadType,
} from "@/types/upload/client";
import { getFileExtension } from "./mime";
import { getR2Config } from "./r2";

const TRAILING_SLASH_REGEX = /\/$/;

interface ResolvedUploadTarget {
  bucketName: string;
  fileSize: number;
  fileType: string;
  key: string;
  publicUrl: string;
}

async function assertUploadAccess({
  headers,
  type,
}: {
  headers: Headers;
  type: UploadType;
}) {
  const { session, user } = await assertAuthenticated({ headers });
  const organizationId = session.activeOrganizationId;

  if ((type === "logo" || type === "content") && !organizationId) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Active organization required for this upload type",
    });
  }

  if ((type === "logo" || type === "content") && organizationId) {
    const membership = await db.query.members.findFirst({
      where: and(
        eq(members.userId, user.id),
        eq(members.organizationId, organizationId)
      ),
      columns: { id: true },
    });

    if (!membership) {
      throw new ORPCError("FORBIDDEN", {
        message: "You do not have access to this organization",
      });
    }
  }

  return {
    organizationId,
    userId: user.id,
  };
}

async function resolveUploadTarget({
  fileSize,
  fileType,
  headers,
  type,
}: {
  fileSize: number;
  fileType: string;
  headers: Headers;
  type: UploadType;
}): Promise<ResolvedUploadTarget> {
  const { organizationId, userId } = await assertUploadAccess({
    headers,
    type,
  });

  validateUpload({
    fileSize,
    fileType,
    type,
  });

  const id = nanoid();
  const extension = getFileExtension(fileType);

  let key: string;

  switch (type) {
    case "avatar":
      key = `user/${userId}/avatar/${id}.${extension}`;
      break;
    case "logo":
      key = `organization/${organizationId}/logo/${id}.${extension}`;
      break;
    case "content":
      key = `organization/${organizationId}/content/${id}.${extension}`;
      break;
    case "chat":
      key = `user/${userId}/chat/${id}.${extension}`;
      break;
    default:
      throw new ORPCError("BAD_REQUEST", {
        message: "Unsupported upload type",
      });
  }

  const { bucketName, publicUrl } = getR2Config();
  const normalizedPublicUrl = publicUrl.replace(TRAILING_SLASH_REGEX, "");

  return {
    bucketName,
    fileSize,
    fileType,
    key,
    publicUrl: `${normalizedPublicUrl}/${key}`,
  };
}

export async function createPresignedUpload({
  fileSize,
  fileType,
  headers,
  type,
}: {
  fileSize: number;
  fileType: string;
  headers: Headers;
  type: UploadType;
}): Promise<UploadPresignedResponse> {
  const target = await resolveUploadTarget({
    fileSize,
    fileType,
    headers,
    type,
  });
  const { client: r2Client } = getR2Config();
  const url = await getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: target.bucketName,
      Key: target.key,
      ContentLength: target.fileSize,
      ContentType: target.fileType,
    }),
    { expiresIn: 3600 }
  );

  return {
    key: target.key,
    publicUrl: target.publicUrl,
    url,
  };
}

export async function deleteChatUpload({
  key,
  headers,
}: {
  key: string;
  headers: Headers;
}) {
  const { userId } = await assertUploadAccess({
    headers,
    type: "chat",
  });
  const expectedPrefix = `user/${userId}/chat/`;

  if (!key.startsWith(expectedPrefix)) {
    throw new ORPCError("FORBIDDEN", {
      message: "You do not have access to this chat upload",
    });
  }

  const { client: r2Client, bucketName } = getR2Config();
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );

  return { success: true };
}
