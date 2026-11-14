import { AUTOPILOT_DIAGRAM_EMBED } from "@/constants/autopilot";
import type {
  AutopilotDiagram,
  AutopilotRepositoryImage,
} from "@/types/autopilot-runtime";

/**
 * Swaps the writer's `![alt](notra-diagram-<id>)` embeds for real image URLs
 * and returns only the diagrams the post uses. An embed of a diagram that
 * doesn't exist is removed, so a post never ships a broken image.
 */
export function resolveDiagramEmbeds(
  content: string,
  diagrams: readonly AutopilotDiagram[],
  locate: (id: number) => { path: string; url: string }
): { content: string; files: AutopilotRepositoryImage[] } {
  const byId = new Map(diagrams.map((diagram) => [diagram.id, diagram]));
  const files = new Map<number, AutopilotRepositoryImage & { url: string }>();
  const resolved = content.replace(
    AUTOPILOT_DIAGRAM_EMBED,
    (_match, alt: string, id: string) => {
      const diagram = byId.get(Number(id));
      if (!diagram) {
        return "";
      }
      let file = files.get(diagram.id);
      if (!file) {
        const location = locate(diagram.id);
        file = {
          path: location.path,
          url: location.url,
          contents: diagram.pngBase64,
          encoding: "base64",
        };
        files.set(diagram.id, file);
      }
      return `![${alt.trim() || diagram.alt}](${file.url})`;
    }
  );
  return {
    content: resolved,
    files: [...files.values()].map(({ url: _url, ...file }) => file),
  };
}
