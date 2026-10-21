import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@/components/teriip-onboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TERIIP Research Workspace" },
      {
        name: "description",
        content: "Secure TERIIP workspace for centre data review and research monitoring.",
      },
      { property: "og:title", content: "TERIIP Research Workspace" },
      {
        property: "og:description",
        content: "Sign in to the secure TERIIP centre research workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomeView,
});
