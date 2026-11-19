import { createFileRoute } from "@tanstack/react-router";
import { ImportView } from "@/components/teriip-views";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Excel Import — TERIIP" },
      {
        name: "description",
        content: "Map workbook columns after an approved TERIIP workbook source is available.",
      },
      { property: "og:title", content: "Excel Import — TERIIP" },
      {
        property: "og:description",
        content: "TERIIP workbook import workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportView,
});
