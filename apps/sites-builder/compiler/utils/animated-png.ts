const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Whether a PNG is an APNG. Image decoders read only its first frame, so a
 * resized copy would silently stop the animation. APNGs declare it with an
 * `acTL` chunk before the first `IDAT`.
 */
export function isAnimatedPng(data: Uint8Array): boolean {
  if (!PNG_SIGNATURE.every((byte, index) => data[index] === byte)) {
    return false;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= data.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
    if (type === "acTL") {
      return true;
    }
    if (type === "IDAT" || type === "IEND") {
      return false;
    }
    offset += 12 + length;
  }
  return false;
}
