import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/teriip-views";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TERIIP Research Workspace" },
      {
        name: "description",
        content:
          "Synthetic-only workspace preview for TERIIP centre data review and research monitoring.",
      },
      { property: "og:title", content: "TERIIP Research Workspace" },
      {
        property: "og:description",
        content:
          "Explore a safe demonstration of TERIIP centre data review and research monitoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardView,
});
