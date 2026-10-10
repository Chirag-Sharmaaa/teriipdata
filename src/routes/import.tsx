import { createFileRoute } from "@tanstack/react-router";
import { ImportView } from "@/components/teriip-views";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Excel Import — TERIIP" },
      {
        name: "description",
        content: "Review fabricated TERIIP spreadsheet columns and parameter mappings.",
      },
      { property: "og:title", content: "Excel Import — TERIIP" },
      {
        property: "og:description",
        content: "A synthetic-only TERIIP spreadsheet mapping demonstration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportView,
});
