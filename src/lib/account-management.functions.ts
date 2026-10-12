import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManageTeriipRole, isKnownCentre, type ManagedRole, type TeriipRole } from "@/lib/teriip-access";
import { TERIIP_CENTRES } from "@/lib/teriip-schema";

const manageableRoleSchema = z.enum(["centre_admin", "centre_staff"]);
const centreSchema = z.enum(TERIIP_CENTRES);

async function getActiveActor(context: { supabase: any; userId: string }) {
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

async function writeAudit(
  admin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  actorId: string,
  subjectId: string,
  centreId: string | null,
  eventType: string,
  action: string,
) {
  const { error } = await admin.from("account_audit_events").insert({
    actor_user_id: actorId,
    subject_user_id: subjectId,
    centre_id: centreId,
    event_type: eventType,
    details: { action },
  });
  return !error;
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

const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(1).max(120),
  role: manageableRoleSchema,
  centreId: centreSchema,
});

export const inviteTeriipAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await getActiveActor(context);
    if (!isKnownCentre(data.centreId) || !canManageTeriipRole(actor.role, data.role, actor.centre_id, data.centreId)) {
      return { ok: false, message: "You cannot invite this role to that centre." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const siteOrigin = new URL(getRequest().url).origin;
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email.toLowerCase(),
      {
        data: { name: data.displayName },
        redirectTo: new URL("/auth?flow=invite", siteOrigin).toString(),
      },
    );
    if (inviteError || !invited.user) {
      return { ok: false, message: "The invitation could not be sent. Check the address and try again." };
    }

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: invited.user.id,
      role: data.role,
      centre_id: data.centreId,
    });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
      return { ok: false, message: "The account could not be assigned securely. The invitation was cancelled." };
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", invited.user.id);
    const auditSaved = await writeAudit(
      supabaseAdmin,
      context.userId,
      invited.user.id,
      data.centreId,
      "account.invited",
      data.role,
    );
    if (profileError || !auditSaved) {
      await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
      return { ok: false, message: "The invitation was cancelled because account setup could not be completed." };
    }
    return { ok: true, message: "Invitation sent. The recipient must verify their email and set a password." };
  });

const accountActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    userId: z.string().uuid(),
    role: manageableRoleSchema,
    centreId: centreSchema,
    displayName: z.string().trim().min(1).max(120),
    username: z.string().trim().max(60).nullable(),
  }),
  z.object({ action: z.literal("disable"), userId: z.string().uuid() }),
  z.object({ action: z.literal("enable"), userId: z.string().uuid() }),
  z.object({ action: z.literal("delete"), userId: z.string().uuid() }),
]);

export const manageTeriipAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => accountActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const actor = await getActiveActor(context);
    if (data.userId === context.userId) return { ok: false, message: "You cannot manage your own administrator account here." };
    const { data: target, error: targetError } = await context.supabase
      .from("user_roles")
      .select("user_id, role, centre_id, disabled_at")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (targetError || !target || !canManageTeriipRole(actor.role, target.role, actor.centre_id, target.centre_id)) {
      return { ok: false, message: "That account is outside your management scope." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "update") {
      if (!isKnownCentre(data.centreId) || !canManageTeriipRole(actor.role, data.role, actor.centre_id, data.centreId)) {
        return { ok: false, message: "You cannot assign that role to the selected centre." };
      }
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .update({ role: data.role, centre_id: data.centreId })
        .eq("user_id", data.userId);
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ display_name: data.displayName, username: data.username || null })
        .eq("id", data.userId);
      if (roleError || profileError) return { ok: false, message: "The account could not be updated." };
      const auditSaved = await writeAudit(supabaseAdmin, context.userId, data.userId, data.centreId, "account.updated", "profile_or_access_updated");
      return auditSaved
        ? { ok: true, message: "Account details updated." }
        : { ok: false, message: "Account details changed, but the required audit entry could not be recorded." };
    }

    if (data.action === "disable" || data.action === "enable") {
      const disabledAt = data.action === "disable" ? new Date().toISOString() : null;
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ disabled_at: disabledAt })
        .eq("user_id", data.userId);
      if (error) return { ok: false, message: "The account status could not be changed." };
      const saved = await writeAudit(
        supabaseAdmin,
        context.userId,
        data.userId,
        target.centre_id,
        data.action === "disable" ? "account.disabled" : "account.enabled",
        data.action,
      );
      return saved
        ? { ok: true, message: data.action === "disable" ? "Account disabled." : "Account re-enabled." }
        : { ok: false, message: "Account status changed, but the required audit entry could not be recorded." };
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (deleteError) return { ok: false, message: "The account could not be deleted." };
    const saved = await writeAudit(supabaseAdmin, context.userId, data.userId, target.centre_id, "account.deleted", "delete");
    return saved
      ? { ok: true, message: "Account deleted." }
      : { ok: false, message: "Account deleted, but the required audit entry could not be recorded." };
  });