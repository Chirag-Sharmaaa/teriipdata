import { createFileRoute } from "@tanstack/react-router";
import { UploadView } from "@/components/teriip-views";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "PDF Review — TERIIP" },
      { name: "description", content: "Review a fabricated TERIIP blood report example in the safe demonstration workspace." },
      { property: "og:title", content: "PDF Review — TERIIP" },
      { property: "og:description", content: "A synthetic-only TERIIP report review demonstration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadView,
});