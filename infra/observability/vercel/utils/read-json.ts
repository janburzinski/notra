import { MAX_RESPONSE_BYTES } from "../constants/metrics.ts";

export async function readJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("invalid_response");
  }
  let failure = "invalid_response";
  try {
    const length = response.headers.get("content-length");
    if (length && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BYTES) {
      failure = "response_byte_limit";
      throw new Error(failure);
    }
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        failure = "response_byte_limit";
        throw new Error(failure);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new Error(failure);
  } finally {
    reader.releaseLock();
  }
}
