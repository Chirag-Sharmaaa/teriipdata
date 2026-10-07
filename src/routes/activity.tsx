import { createFileRoute } from "@tanstack/react-router";
import { ActivityView } from "@/components/teriip-views";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Recent Activity — TERIIP" },
      { name: "description", content: "See synthetic examples of TERIIP report review and spreadsheet import statuses." },
      { property: "og:title", content: "Recent Activity — TERIIP" },
      { property: "og:description", content: "Synthetic workflow history in the TERIIP demonstration workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityView,
});