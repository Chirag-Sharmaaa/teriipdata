import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TEMPORARY_LOGIN_DOMAIN } from "@/lib/teriip-access";

const loginInput = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(72),
});

function authConfiguration() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Sign-in is temporarily unavailable.");
  return { url, key };
}

async function emailForLogin(identifier: string) {
  if (identifier.includes("@")) return identifier.toLowerCase();
  const normalizedUsername = identifier.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(normalizedUsername)) {
    return `${normalizedUsername}@${TEMPORARY_LOGIN_DOMAIN}`;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("username", normalizedUsername)
    .maybeSingle();
  if (error) throw new Error("Sign-in failed. Check your username or email and password.");
  return data?.email ?? `${normalizedUsername}@${TEMPORARY_LOGIN_DOMAIN}`;
}

export const signInTeriipAccount = createServerFn({ method: "POST" })
  .validator(loginInput)
  .handler(async ({ data }) => {
    const email = await emailForLogin(data.identifier);
    const { url, key } = authConfiguration();
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: result, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !result.session) {
      throw new Error("Sign-in failed. Check your username or email and password.");
    }
    return {
      accessToken: result.session.access_token,
      refreshToken: result.session.refresh_token,
    };
  });
