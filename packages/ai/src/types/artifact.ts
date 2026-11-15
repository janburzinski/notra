import type {
  ARTIFACT_ACTORS,
  ARTIFACT_SOURCES,
} from "@notra/ai/constants/artifacts";
import type {
  artifactAutopilotBlockSchema,
  artifactBlockSchema,
  artifactContentSchema,
  toolOutputArtifactSchema,
} from "@notra/ai/schemas/artifact";
import type { z } from "zod";

export type ArtifactContent = z.infer<typeof artifactContentSchema>;
export type ArtifactBlock = z.infer<typeof artifactBlockSchema>;
export type ArtifactAutopilotBlock = z.infer<
  typeof artifactAutopilotBlockSchema
>;
export type ArtifactSource = (typeof ARTIFACT_SOURCES)[number];
export type ArtifactActor = (typeof ARTIFACT_ACTORS)[number];
export type ArtifactToolOutput = z.infer<typeof toolOutputArtifactSchema>;

export interface ArtifactFileIssue {
  /** 1-based line in the file. */
  line: number;
  message: string;
}

export interface ParsedArtifactFile {
  /** null when nothing usable is left. */
  content: ArtifactContent | null;
  issues: ArtifactFileIssue[];
}

export interface ArtifactWriter {
  organizationId: string;
  chatId?: string | null;
  userId?: string | null;
  source: ArtifactSource;
}

export interface SavedArtifact {
  id: string;
  title: string;
  summary: string | null;
  version: number;
  url: string;
  /** Blocks dropped because they pointed at nothing, so the agent can say so. */
  warnings: string[];
}
