import { GlobalCanvasClient } from "@/components/GlobalCanvasClient";
import { RouteSummary } from "@/components/RouteSummary";
import { pageMetadata } from "@/lib/site";

const TITLE = "Board";
const DESCRIPTION =
  "A fixed-size, full-screen shared drawing board — no zooming or panning, the whole board at a glance. Same brushes and tools as the live canvas.";

export const metadata = pageMetadata({ path: "/board", title: TITLE, description: DESCRIPTION });

export default function BoardPage() {
  return (
    <>
      <RouteSummary heading={TITLE} summary={DESCRIPTION} />
      <GlobalCanvasClient mode="board" />
    </>
  );
}
