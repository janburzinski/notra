import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  DeleteChatUploadProps,
  UploadFileProps,
  UploadFileResponse,
  UploadPresignedResponse,
  UploadType,
} from "@/types/upload/client";

async function getPresignedUrl(
  file: File,
  type: UploadType
): Promise<UploadPresignedResponse> {
  return dashboardOrpc.upload.createPresignedUpload.call({
    type,
    fileType: file.type,
    fileSize: file.size,
  });
}

async function uploadToR2(presignedUrl: string, file: File) {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status})`);
  }
}

export async function uploadFile({
  file,
  type,
}: UploadFileProps): Promise<UploadFileResponse> {
  const { url, key, publicUrl } = await getPresignedUrl(file, type);
  await uploadToR2(url, file);
  return { url: publicUrl, key };
}

export async function deleteChatUpload({
  key,
}: DeleteChatUploadProps): Promise<void> {
  await dashboardOrpc.upload.deleteChatUpload.call({ key });
}
