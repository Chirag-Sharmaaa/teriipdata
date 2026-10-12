import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TeriipRole } from "@/lib/teriip-access";

type ActorContext = { supabase: any; userId: string };

async function getActiveActor(context: ActorContext) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role, centre_id, disabled_at")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data || data.disabled_at) throw new Error("Your account is not authorized for this action.");
  if (data.role !== "super_admin" && data.role !== "centre_admin") {
    throw new Error("Your account is not authorized for this action.");
  }
  return data as { role: TeriipRole; centre_id: string | null; disabled_at: string | null };
}

export const listManageableAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await getActiveActor(context);
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role, centre_id, disabled_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load the accounts in your management scope.");
    const ids = (roles ?? []).map((row: { user_id: string }) => row.user_id);
    if (ids.length === 0) return { actorRole: actor.role, accounts: [] };

    const { data: profiles, error: profileError } = await context.supabase
      .from("profiles")
      .select("id, email, username, display_name")
      .in("id", ids);
    if (profileError) throw new Error("Could not load account details.");
    const profileById = new Map((profiles ?? []).map((profile: { id: string }) => [profile.id, profile]));
    return {
      actorRole: actor.role,
      accounts: (roles ?? []).map((row: { user_id: string; role: TeriipRole; centre_id: string | null; disabled_at: string | null; created_at: string }) => ({
        userId: row.user_id,
        role: row.role,
        centreId: row.centre_id,
        disabled: Boolean(row.disabled_at),
        createdAt: row.created_at,
        ...(profileById.get(row.user_id) ?? { email: null, username: null, display_name: null }),
      })),
    };
  });

export const inviteTeriipAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    ok: false,
    message: "Invitations are unavailable until secure account-provisioning access and the verified centre roster are configured.",
  }));

export const manageTeriipAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    ok: false,
    message: "Account changes are unavailable until secure account-provisioning access is configured.",
  }));