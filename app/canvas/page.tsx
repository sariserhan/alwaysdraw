import { GlobalCanvasClient } from "@/components/GlobalCanvasClient";
import { RouteSummary } from "@/components/RouteSummary";
import { pageMetadata } from "@/lib/site";

const TITLE = "Live World Canvas";
const DESCRIPTION =
  "One endless drawing canvas shared by everyone on the internet, live in real time. No sign-up.";

export const metadata = pageMetadata({ path: "/canvas", title: TITLE, description: DESCRIPTION });

export default function CanvasPage() {
  return (
    <>
      <RouteSummary heading={TITLE} summary={DESCRIPTION} />
      <GlobalCanvasClient />
    </>
  );
}
