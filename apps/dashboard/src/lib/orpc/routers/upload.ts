import { authorizedProcedure } from "@/lib/orpc/base";
import {
  createPresignedUpload,
  deleteChatUpload,
  recordChatAttachment,
} from "@/lib/upload/server";
import {
  deleteChatUploadSchema,
  recordChatAttachmentSchema,
  uploadSchema,
  validateUpload,
} from "@/schemas/upload";

export const uploadRouter = {
  createPresignedUpload: authorizedProcedure
    .input(uploadSchema)
    .handler(async ({ context, input }) => {
      validateUpload({
        fileSize: input.fileSize,
        fileType: input.fileType,
        type: input.type,
      });

      return createPresignedUpload({
        fileSize: input.fileSize,
        fileType: input.fileType,
        headers: context.headers,
        type: input.type,
      });
    }),
  deleteChatUpload: authorizedProcedure
    .input(deleteChatUploadSchema)
    .handler(async ({ context, input }) => {
      return deleteChatUpload({
        headers: context.headers,
        key: input.key,
      });
    }),
  recordChatAttachment: authorizedProcedure
    .input(recordChatAttachmentSchema)
    .handler(async ({ context, input }) => {
      return recordChatAttachment({
        headers: context.headers,
        key: input.key,
        filename: input.filename,
        mediaType: input.mediaType,
        size: input.size,
      });
    }),
};
