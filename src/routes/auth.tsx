import { createFileRoute } from "@tanstack/react-router";
import { AuthView } from "@/components/teriip-auth-pages";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
    flow: search.flow === "invite" ? "invite" as const : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Secure sign in — TERIIP" },
      { name: "description", content: "Sign in to the TERIIP research workspace." },
      { property: "og:title", content: "Secure sign in — TERIIP" },
      { property: "og:description", content: "Secure account access for the TERIIP research workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthView,
});