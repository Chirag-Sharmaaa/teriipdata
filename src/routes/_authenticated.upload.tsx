import { createFileRoute } from "@tanstack/react-router";
import { UploadView } from "@/components/teriip-views";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "PDF Review — TERIIP" },
      {
        name: "description",
        content: "Review report fields when an approved TERIIP report source is available.",
      },
      { property: "og:title", content: "PDF Review — TERIIP" },
      {
        property: "og:description",
        content: "TERIIP report review workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadView,
});
