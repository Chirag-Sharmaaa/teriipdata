import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "@/components/teriip-auth-pages";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account settings — TERIIP" },
      { name: "description", content: "Manage your TERIIP account details, email verification, and password." },
      { property: "og:title", content: "Account settings — TERIIP" },
      { property: "og:description", content: "Manage your TERIIP account details and security." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsView,
});