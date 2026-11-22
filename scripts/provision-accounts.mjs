import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync, appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SECOND_SUPER_ADMIN_EMAIL = "teriipicmr@gmail.com";
const TEMPORARY_LOGIN_DOMAIN = "temp-login.teriip.invalid";
const CREDENTIAL_FILE = "temp-credentials.csv";
const FORMER_PROJECT_REF = "muvdlesmqcwfaiffqggv";

const CENTRES = [
  ["aiims-bathinda", "Bhatinda"],
  ["aiims-bhopal", "AIIMS Bhopal"],
  ["aiims-delhi", "Delhi"],
  ["aiims-guwahati", "Guwahati"],
  ["aiims-jodhpur", "Jodhpur"],
  ["aiims-kalyani", "Kalyani"],
  ["aiims-raipur", "Raipur"],
  ["amrita-kochi", "Amrita Kochi"],
  ["bbci-guwahati", "BCCI Guwahati"],
  ["jss-mysuru", "JSS Mysore"],
  ["kgmu-lucknow", "KGMU Lucknow"],
  ["kims-bhubaneswar", "KIMS Bhubaneswar"],
  ["kmc-manipal", "KMC Manipal"],
  ["nirrh-port-blair", "NIRRH Port Blair"],
  ["pd-hinduja-mumbai", "P D Hinduja"],
  ["pgimer-chandigarh", "PGIMER Chandigarh"],
];

function readEnvFile(filename) {
  if (!existsSync(filename)) return {};
  const values = {};
  for (const rawLine of readFileSync(filename, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[line.slice(0, separator).trim()] = value;
  }
  return values;
}

function env(name, fileValues) {
  return process.env[name]?.trim() || fileValues[name]?.trim() || "";
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function randomPassword() {
  return randomBytes(18).toString("base64url");
}

function saveTemporaryCredential(username, centreName, password) {
  if (!existsSync(CREDENTIAL_FILE)) {
    writeFileSync(CREDENTIAL_FILE, "username,centre,temp_password\n", {
      encoding: "utf8",
      mode: 0o600,
    });
  }
  appendFileSync(
    CREDENTIAL_FILE,
    [csvCell(username), csvCell(centreName), csvCell(password)].join(",") + "\n",
  );
  try {
    chmodSync(CREDENTIAL_FILE, 0o600);
  } catch {}
}

async function listUsers(admin) {
  const users = [];
  let page = 1;
  while (true) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw new Error("Could not read existing accounts.");
    users.push(...result.data.users);
    if (result.data.users.length < 1000) return users;
    page += 1;
  }
}

async function ensureCentreAccount(admin, existingByEmail, username, centreName) {
  const temporaryEmail = `${username}@${TEMPORARY_LOGIN_DOMAIN}`;
  const namedProfile = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (namedProfile.error) throw new Error(`Could not check the profile for ${username}.`);
  if (namedProfile.data) {
    const role = await admin
      .from("user_roles")
      .select("role, centre_id")
      .eq("user_id", namedProfile.data.id)
      .maybeSingle();
    if (role.error) throw new Error(`Could not check the role for ${username}.`);
    if (!role.data) {
      const inserted = await admin.from("user_roles").insert({
        user_id: namedProfile.data.id,
        role: "centre_admin",
        centre_id: centreName,
      });
      if (inserted.error) throw new Error(`Could not assign ${username} to its centre.`);
    } else if (role.data.role !== "centre_admin" || role.data.centre_id !== centreName) {
      throw new Error(
        `${username} already exists with a different centre assignment; no change was made.`,
      );
    }
    return { created: false, password: null };
  }

  if (existingByEmail.has(temporaryEmail)) {
    const existing = existingByEmail.get(temporaryEmail);
    const profile = await admin
      .from("profiles")
      .upsert({ id: existing.id, email: temporaryEmail, username }, { onConflict: "id" });
    if (profile.error) throw new Error(`Could not check the profile for ${username}.`);
    const role = await admin
      .from("user_roles")
      .select("user_id, role, centre_id")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (role.error) throw new Error(`Could not check the role for ${username}.`);
    if (!role.data) {
      const inserted = await admin.from("user_roles").insert({
        user_id: existing.id,
        role: "centre_admin",
        centre_id: centreName,
      });
      if (inserted.error) throw new Error(`Could not assign ${username} to its centre.`);
    } else if (role.data.role !== "centre_admin" || role.data.centre_id !== centreName) {
      throw new Error(
        `${username} already exists with a different centre assignment; no change was made.`,
      );
    }
    return { created: false, password: null };
  }

  const password = randomPassword();
  const created = await admin.auth.admin.createUser({
    email: temporaryEmail,
    password,
    email_confirm: true,
    app_metadata: { teriip_onboarding: "email" },
    user_metadata: { name: username },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Could not create the account for ${username}.`);
  }
  const userId = created.data.user.id;
  const profileUpdate = await admin
    .from("profiles")
    .upsert({ id: userId, email: temporaryEmail, username }, { onConflict: "id" });
  const roleInsert = await admin.from("user_roles").insert({
    user_id: userId,
    role: "centre_admin",
    centre_id: centreName,
  });
  if (profileUpdate.error || roleInsert.error) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`Could not finish account setup for ${username}.`);
  }
  try {
    saveTemporaryCredential(username, centreName, password);
  } catch {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(
      `Could not safely save the temporary password for ${username}; its account was removed.`,
    );
  }
  return { created: true, password };
}

async function ensureNamedSuperAdmin(admin, appUrl, email) {
  const users = await listUsers(admin);
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const role = await admin
      .from("user_roles")
      .select("user_id, role")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (role.error) throw new Error(`Could not check the Super Admin role for ${email}.`);
    if (!role.data) {
      const metadata = await admin.auth.admin.updateUserById(existing.id, {
        app_metadata: { ...(existing.app_metadata ?? {}), teriip_onboarding: "password" },
      });
      if (metadata.error) throw new Error(`Could not prepare first login for ${email}.`);
      const inserted = await admin.from("user_roles").insert({
        user_id: existing.id,
        role: "super_admin",
        centre_id: null,
      });
      if (inserted.error) throw new Error(`Could not assign Super Admin access to ${email}.`);
    } else if (role.data.role !== "super_admin") {
      throw new Error(`${email} already has another role; no change was made.`);
    }
    return;
  }

  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/onboarding`,
  });
  if (invited.error || !invited.data.user) {
    throw new Error(`Could not invite the Super Admin ${email}.`);
  }
  const metadata = await admin.auth.admin.updateUserById(invited.data.user.id, {
    app_metadata: {
      ...(invited.data.user.app_metadata ?? {}),
      teriip_onboarding: "password",
    },
  });
  const role = await admin.from("user_roles").insert({
    user_id: invited.data.user.id,
    role: "super_admin",
    centre_id: null,
  });
  if (metadata.error || role.error) {
    await admin.auth.admin.deleteUser(invited.data.user.id);
    throw new Error(
      `Could not finish Super Admin setup for ${email}; the invitation was withdrawn.`,
    );
  }
}

const fileValues = readEnvFile(".env.local");
const url = env("SUPABASE_URL", fileValues);
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY", fileValues);
const browserUrl = env("VITE_SUPABASE_URL", fileValues);
const publishableKey = env("SUPABASE_PUBLISHABLE_KEY", fileValues);
const browserPublishableKey = env("VITE_SUPABASE_PUBLISHABLE_KEY", fileValues);
const ownSuperAdminEmail = env("TERIIP_SUPER_ADMIN_EMAIL", fileValues).trim().toLowerCase();
if (
  !url ||
  !serviceKey ||
  !ownSuperAdminEmail ||
  url !== browserUrl ||
  !publishableKey ||
  publishableKey !== browserPublishableKey
) {
  console.error(
    "Set matching SUPABASE_URL/VITE_SUPABASE_URL and publishable keys, plus SUPABASE_SERVICE_ROLE_KEY and TERIIP_SUPER_ADMIN_EMAIL in .env.local. Provisioning was not run.",
  );
  process.exit(1);
}
if (url.includes(FORMER_PROJECT_REF)) {
  console.error("The configured Supabase project is the old project. Provisioning was not run.");
  process.exit(1);
}
let parsedProjectUrl;
try {
  parsedProjectUrl = new URL(url);
} catch {
  console.error("SUPABASE_URL must be a valid HTTPS Supabase project URL.");
  process.exit(1);
}
if (parsedProjectUrl.protocol !== "https:" || !parsedProjectUrl.hostname.endsWith(".supabase.co")) {
  console.error("SUPABASE_URL must be a valid HTTPS Supabase project URL.");
  process.exit(1);
}

const appUrl = (env("TERIIP_APP_URL", fileValues) || "http://localhost:8080").replace(/\/+$/, "");
let parsedAppUrl;
try {
  parsedAppUrl = new URL(appUrl);
} catch {
  console.error("TERIIP_APP_URL must be a valid localhost or HTTPS site URL.");
  process.exit(1);
}
if (
  (parsedAppUrl.protocol !== "https:" && parsedAppUrl.hostname !== "localhost") ||
  parsedAppUrl.username ||
  parsedAppUrl.password
) {
  console.error("TERIIP_APP_URL must be a localhost or HTTPS site URL.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const users = await listUsers(admin);
const existingByEmail = new Map(
  users.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user]),
);

await ensureNamedSuperAdmin(admin, appUrl, SECOND_SUPER_ADMIN_EMAIL);
if (ownSuperAdminEmail !== SECOND_SUPER_ADMIN_EMAIL) {
  await ensureNamedSuperAdmin(admin, appUrl, ownSuperAdminEmail);
}

let createdCount = 0;
let skippedCount = 0;
for (const [username, centreName] of CENTRES) {
  const result = await ensureCentreAccount(admin, existingByEmail, username, centreName);
  if (!result.created) {
    skippedCount += 1;
    continue;
  }
  createdCount += 1;
}

console.log(
  `Provisioning complete: ${createdCount} centre accounts created, ${skippedCount} existing centre accounts checked, second Super Admin ensured. Credentials file: ${CREDENTIAL_FILE}`,
);
