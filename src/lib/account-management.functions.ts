import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canManageTeriipRole,
  isKnownCentre,
  isValidRealEmail,
  safeAccountLinkOrigin,
  type ManagedRole,
  type TeriipRole,
} from "@/lib/teriip-access";
import type { Database } from "@/integrations/supabase/types";

type ActorContext = { supabase: SupabaseClient<Database>; userId: string };
type Actor = { role: TeriipRole; centre_id: string | null };

async function getActiveActor(context: ActorContext): Promise<Actor> {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role, centre_id, disabled_at")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || !data || data.disabled_at)
    throw new Error("Your account is not authorized for this action.");
  if (data.role !== "super_admin" && data.role !== "centre_admin") {
    throw new Error("Your account is not authorized for this action.");
  }
  // The database only answers as an administrator once first-login setup is finished.
  const { data: isActive } = await context.supabase.rpc("has_role", { _role: data.role });
  if (!isActive) throw new Error("Finish your first-login setup before managing accounts.");
  return { role: data.role, centre_id: data.centre_id };
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadTarget(userId: string) {
  const admin = await loadAdmin();
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id, role, centre_id, disabled_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("That account could not be found.");
  return { admin, target: data };
}

async function audit(
  actorId: string,
  subjectId: string | null,
  centreId: string | null,
  eventType: "account.invited" | "account.updated" | "account.disabled" | "account.enabled" | "account.deleted",
  details: Record<string, string | null> = {},
) {
  const admin = await loadAdmin();
  await admin.from("account_audit_events").insert({
    actor_user_id: actorId,
    subject_user_id: subjectId,
    centre_id: centreId,
    event_type: eventType,
    details,
  });
}

function validateAssignment(input: { role?: unknown; centreId?: unknown }) {
  const role = input.role;
  if (role !== "centre_admin" && role !== "centre_staff") throw new Error("Choose a valid access level.");
  const centreId = typeof input.centreId === "string" ? input.centreId : null;
  if (!isKnownCentre(centreId)) throw new Error("Choose a valid TERIIP centre.");
  return { role: role as ManagedRole, centreId };
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
    const ids = (roles ?? []).map((row) => row.user_id);
    if (ids.length === 0)
      return { actorRole: actor.role, actorCentre: actor.centre_id, accounts: [] };

    const { data: profiles, error: profileError } = await context.supabase
      .from("profiles")
      .select("id, email, username, display_name")
      .in("id", ids);
    if (profileError) throw new Error("Could not load account details.");
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return {
      actorRole: actor.role,
      actorCentre: actor.centre_id,
      accounts: (roles ?? []).map((row) => {
        const profile = profileById.get(row.user_id);
        return {
          userId: row.user_id,
          role: row.role,
          centreId: row.centre_id,
          disabled: Boolean(row.disabled_at),
          createdAt: row.created_at,
          email: profile?.email ?? null,
          username: profile?.username ?? null,
          display_name: profile?.display_name ?? null,
        };
      }),
    };
  });

export const inviteTeriipAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; displayName?: string; role: ManagedRole; centreId: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!isValidRealEmail(email)) throw new Error("Enter a valid email address.");
    const displayName = String(input?.displayName ?? "").trim().slice(0, 120);
    return { email, displayName, ...validateAssignment(input) };
  })
  .handler(async ({ data, context }) => {
    const actor = await getActiveActor(context);
    if (!canManageTeriipRole(actor.role, data.role, actor.centre_id, data.centreId)) {
      throw new Error("You can only invite accounts within your management scope.");
    }
    const origin = safeAccountLinkOrigin(getRequest()?.headers.get("origin"));
    if (!origin) throw new Error("Invitations must be sent from the TERIIP website.");

    const admin = await loadAdmin();
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: `${origin}/onboarding`,
      data: data.displayName ? { name: data.displayName } : undefined,
    });
    if (error || !invited.user) {
      throw new Error(
        error && /already|registered|exists/i.test(error.message)
          ? "That email address already has a TERIIP account."
          : `The invitation email could not be sent${error ? `: ${error.message}` : "."}`,
      );
    }
    const userId = invited.user.id;
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role, centre_id: data.centreId });
    if (roleError) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error("The account role could not be saved, so the invitation was withdrawn.");
    }
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(invited.user.app_metadata ?? {}), teriip_onboarding: "password" },
    });
    await audit(context.userId, userId, data.centreId, "account.invited", { role: data.role });
    return { ok: true as const, message: `Invitation sent to ${data.email}.` };
  });

export const updateTeriipAccountAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: ManagedRole; centreId: string }) => ({
    userId: String(input?.userId ?? ""),
    ...validateAssignment(input),
  }))
  .handler(async ({ data, context }) => {
    const actor = await getActiveActor(context);
    if (data.userId === context.userId) throw new Error("You cannot change your own access.");
    const { admin, target } = await loadTarget(data.userId);
    if (
      !canManageTeriipRole(actor.role, target.role, actor.centre_id, target.centre_id) ||
      !canManageTeriipRole(actor.role, data.role, actor.centre_id, data.centreId)
    ) {
      throw new Error("That change is outside your management scope.");
    }
    const { error } = await admin
      .from("user_roles")
      .update({ role: data.role, centre_id: data.centreId })
      .eq("user_id", data.userId);
    if (error) throw new Error("The access change could not be saved.");
    await audit(context.userId, data.userId, data.centreId, "account.updated", {
      from_role: target.role,
      to_role: data.role,
      from_centre: target.centre_id,
      to_centre: data.centreId,
    });
    return { ok: true as const, message: "Access updated." };
  });

export const setTeriipAccountDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; disabled: boolean }) => ({
    userId: String(input?.userId ?? ""),
    disabled: Boolean(input?.disabled),
  }))
  .handler(async ({ data, context }) => {
    const actor = await getActiveActor(context);
    if (data.userId === context.userId) throw new Error("You cannot disable your own account.");
    const { admin, target } = await loadTarget(data.userId);
    if (!canManageTeriipRole(actor.role, target.role, actor.centre_id, target.centre_id)) {
      throw new Error("That account is outside your management scope.");
    }
    const { error } = await admin
      .from("user_roles")
      .update({ disabled_at: data.disabled ? new Date().toISOString() : null })
      .eq("user_id", data.userId);
    if (error) throw new Error("The account status could not be changed.");
    // Also block sign-in itself, not just data access.
    await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.disabled ? "876000h" : "none",
    });
    await audit(
      context.userId,
      data.userId,
      target.centre_id,
      data.disabled ? "account.disabled" : "account.enabled",
    );
    return { ok: true as const, message: data.disabled ? "Account disabled." : "Account enabled." };
  });

export const deleteTeriipAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: String(input?.userId ?? "") }))
  .handler(async ({ data, context }) => {
    const actor = await getActiveActor(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");
    const { admin, target } = await loadTarget(data.userId);
    if (!canManageTeriipRole(actor.role, target.role, actor.centre_id, target.centre_id)) {
      throw new Error("That account is outside your management scope.");
    }
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("The account could not be deleted.");
    await audit(context.userId, data.userId, target.centre_id, "account.deleted", {
      role: target.role,
    });
    return { ok: true as const, message: "Account deleted." };
  });
