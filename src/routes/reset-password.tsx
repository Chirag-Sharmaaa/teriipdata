import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordView } from "@/components/teriip-auth-pages";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — TERIIP" },
      { name: "description", content: "Choose a new password for your TERIIP account." },
      { property: "og:title", content: "Set a new password — TERIIP" },
      { property: "og:description", content: "Securely reset your TERIIP account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordView,
});