import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidRealEmail, onboardingStage, passwordProblem } from "@/lib/teriip-access";

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadUser(userId: string) {
  const admin = await loadAdmin();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error("Your account could not be loaded.");
  return { admin, user: data.user };
}

/** Step 1: the person adds the real email address they will use from now on. */
export const submitOnboardingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    if (!isValidRealEmail(email)) throw new Error("Enter a valid email address.");
    return { email };
  })
  .handler(async ({ data, context }) => {
    const { admin, user } = await loadUser(context.userId);
    const meta = { ...(user.app_metadata ?? {}) } as Record<string, unknown>;
    const stage = onboardingStage(meta);
    if (stage !== "email" && stage !== "verify_email") {
      throw new Error("Your email address has already been confirmed.");
    }
    const expected = meta["teriip_expected_email"];
    if (typeof expected === "string" && expected && expected !== data.email) {
      throw new Error("Use the email address registered for this headquarters account.");
    }
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email: data.email,
      email_confirm: true,
      app_metadata: {
        ...meta,
        teriip_onboarding: "verify_email",
        teriip_pending_email: data.email,
      },
    });
    if (error) {
      throw new Error(
        /already|registered|exists/i.test(error.message)
          ? "That email address is already used by another TERIIP account."
          : "Your email address could not be saved. Try again.",
      );
    }
    return { ok: true as const, email: data.email };
  });

/** Step 2: only a session opened from the emailed link proves the address belongs to them. */
export const confirmOnboardingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, user } = await loadUser(context.userId);
    const meta = { ...(user.app_metadata ?? {}) } as Record<string, unknown>;
    if (onboardingStage(meta) !== "verify_email") return { ok: false as const };
    const amr = (
      context.claims as { amr?: Array<{ method?: string; timestamp?: number } | string> }
    ).amr;
    const now = Date.now() / 1000;
    const fromEmailLink = (amr ?? []).some((entry) =>
      typeof entry === "string"
        ? entry === "otp" || entry === "magiclink"
        : (entry.method === "otp" || entry.method === "magiclink") &&
          typeof entry.timestamp === "number" &&
          now - entry.timestamp < 60 * 60,
    );
    if (!fromEmailLink || user.email !== meta["teriip_pending_email"])
      return { ok: false as const };
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...meta, teriip_onboarding: "password", teriip_pending_email: null },
    });
    if (error) throw new Error("Your email confirmation could not be saved. Try again.");
    return { ok: true as const };
  });

/** Step 3: replace the temporary password; this also finishes first-login setup. */
export const completeOnboardingPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { password: string; confirm: string }) => {
    const password = String(input?.password ?? "");
    const problem = passwordProblem(password, String(input?.confirm ?? ""));
    if (problem) throw new Error(problem);
    return { password };
  })
  .handler(async ({ data, context }) => {
    const { admin, user } = await loadUser(context.userId);
    const meta = { ...(user.app_metadata ?? {}) } as Record<string, unknown>;
    if (onboardingStage(meta) !== "password") {
      throw new Error("Confirm your email address before choosing a password.");
    }
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: data.password,
      app_metadata: {
        ...meta,
        teriip_onboarding: null,
        teriip_expected_email: null,
        teriip_pending_email: null,
      },
    });
    if (error) throw new Error("Your password could not be saved. Choose a different password.");
    const { data: role } = await admin
      .from("user_roles")
      .select("centre_id")
      .eq("user_id", user.id)
      .maybeSingle();
    await admin.from("account_audit_events").insert({
      actor_user_id: user.id,
      subject_user_id: user.id,
      centre_id: role?.centre_id ?? null,
      event_type: "account.updated",
      details: { change: "first_login_setup_completed" },
    });
    return { ok: true as const };
  });
