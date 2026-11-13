import { createFileRoute } from "@tanstack/react-router";

import { GameScreen } from "@/components/game-screen";
import { CARD_HEIGHT, CARD_WIDTH } from "@/constants/share-card";
import { SITE_URL } from "@/constants/site";
import { getSharePreview } from "@/lib/share";
import { getViewer } from "@/lib/viewer";
import { formatScore } from "@/utils/format";
import { cardPath, previewTitle } from "@/utils/share";

/** A shared spot on the board: the game itself, with the player's card as the link preview. */
export const Route = createFileRoute("/s/$playerId")({
  loader: async ({ params }) => {
    const [viewer, preview] = await Promise.all([
      getViewer(),
      getSharePreview({ data: params.playerId }).catch(() => null),
    ]);
    return { viewer, preview };
  },
  head: ({ loaderData }) => {
    const preview = loaderData?.preview;
    if (!preview) {
      return {};
    }
    const title = previewTitle(preview);
    const description = `${formatScore(preview.score)} points flying ${preview.model}. Can you beat that?`;
    const image = `${SITE_URL}${cardPath(preview.playerId, preview.score)}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        {
          property: "og:url",
          content: `${SITE_URL}/s/${encodeURIComponent(preview.playerId)}`,
        },
        { property: "og:image", content: image },
        { property: "og:image:width", content: String(CARD_WIDTH) },
        { property: "og:image:height", content: String(CARD_HEIGHT) },
        { property: "og:image:alt", content: title },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: SharePage,
});

function SharePage() {
  return <GameScreen initialViewer={Route.useLoaderData().viewer} />;
}
