import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { UserManagementView } from "@/components/teriip-user-management";

export const Route = createFileRoute("/_authenticated/manage-users")({
  beforeLoad: async () => {
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      throw redirect({ to: "/auth", search: { next: undefined, flow: undefined } });
    }
    const { data: membership, error } = await supabase
      .from("user_roles")
      .select("role, disabled_at")
      .eq("user_id", userResult.user.id)
      .maybeSingle();
    if (error || membership?.disabled_at) {
      throw redirect({ to: "/auth", search: { next: undefined, flow: undefined } });
    }
    if (membership?.role !== "super_admin" && membership?.role !== "centre_admin") {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Team accounts — TERIIP" },
      { name: "description", content: "Invite and manage authorized TERIIP centre accounts." },
      { property: "og:title", content: "Team accounts — TERIIP" },
      { property: "og:description", content: "Manage authorized TERIIP centre accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UserManagementView,
});
