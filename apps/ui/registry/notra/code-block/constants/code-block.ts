export const CODE_BLOCK_COPIED_MS = 1500;

export const CODE_BLOCK_LABELS = {
  command: "Command",
  snippet: "Snippet",
} as const;

export const CODE_BLOCK_COPY_LABELS = {
  idle: (label: string) => `Copy ${label}`,
  copied: (label: string) => `${label} copied`,
  failed: (label: string) => `Copying ${label} failed`,
} as const;
