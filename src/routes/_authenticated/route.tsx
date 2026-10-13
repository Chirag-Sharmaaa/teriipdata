import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.pathname, flow: undefined } });
    }
    const { data: membership, error: roleError } = await supabase
      .from("user_roles")
      .select("disabled_at")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (roleError || !membership || membership.disabled_at) {
      throw redirect({ to: "/auth", search: { next: undefined, flow: undefined } });
    }
  },
  component: () => <Outlet />,
});