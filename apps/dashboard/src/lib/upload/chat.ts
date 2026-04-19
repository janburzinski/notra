export function dragEventHasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) {
    return false;
  }
  for (let index = 0; index < types.length; index += 1) {
    if (types[index] === "Files") {
      return true;
    }
  }
  return false;
}

export function getUnsupportedAttachmentMessage(modelLabel: string) {
  return `${modelLabel} only supports image and PDF attachments. Remove text files or choose a Claude model.`;
}
