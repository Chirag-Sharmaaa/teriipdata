import { createFileRoute } from "@tanstack/react-router";
import { ActivityView } from "@/components/teriip-views";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Recent Activity — TERIIP" },
      {
        name: "description",
        content: "Review report and spreadsheet workflow activity recorded in TERIIP.",
      },
      { property: "og:title", content: "Recent Activity — TERIIP" },
      {
        property: "og:description",
        content: "TERIIP report and spreadsheet workflow history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityView,
});
