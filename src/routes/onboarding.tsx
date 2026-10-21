import { createFileRoute } from "@tanstack/react-router";
import { OnboardingView } from "@/components/teriip-onboarding";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "First login setup — TERIIP" },
      {
        name: "description",
        content: "Confirm your email and choose your own password for your TERIIP account.",
      },
      { property: "og:title", content: "First login setup — TERIIP" },
      { property: "og:description", content: "Finish setting up your TERIIP account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingView,
});
