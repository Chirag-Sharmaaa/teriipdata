import { createFileRoute } from "@tanstack/react-router";
import { AdminView } from "@/components/teriip-views";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Overview — TERIIP" },
      { name: "description", content: "View synthetic centre summaries and mock service status for the TERIIP demonstration." },
      { property: "og:title", content: "Admin Overview — TERIIP" },
      { property: "og:description", content: "A synthetic-only overview of participating TERIIP centres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminView,
});