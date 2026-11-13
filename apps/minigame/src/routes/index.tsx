import { createFileRoute } from "@tanstack/react-router";

import { GameScreen } from "@/components/game-screen";
import { getViewer } from "@/lib/viewer";

export const Route = createFileRoute("/")({
  loader: () => getViewer(),
  component: IndexPage,
});

function IndexPage() {
  return <GameScreen initialViewer={Route.useLoaderData()} />;
}
