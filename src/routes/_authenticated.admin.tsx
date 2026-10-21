import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminView } from "@/components/teriip-views";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userResult } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userResult.user?.id ?? "")
      .maybeSingle();
    if (membership?.role !== "super_admin") throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Admin Overview — TERIIP" },
      {
        name: "description",
        content:
          "View synthetic centre summaries and mock service status for the TERIIP demonstration.",
      },
      { property: "og:title", content: "Admin Overview — TERIIP" },
      {
        property: "og:description",
        content: "A synthetic-only overview of participating TERIIP centres.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminView,
});
