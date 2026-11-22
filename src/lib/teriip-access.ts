import { TERIIP_CENTRES } from "@/lib/teriip-schema";

export type TeriipRole = "super_admin" | "centre_admin" | "centre_staff";
export type ManagedRole = Exclude<TeriipRole, "super_admin">;

/**
 * Temporary logins (no real email yet) use a reserved, undeliverable domain so the
 * auth system has an address while no message is ever sent to a real mailbox.
 */
export const TEMPORARY_LOGIN_DOMAIN = "temp-login.teriip.invalid";

/** First-login steps, stored in server-controlled account metadata. */
export type OnboardingStage = "email" | "verify_email" | "password";

export const MIN_PASSWORD_LENGTH = 12;

export function isKnownCentre(
  centre: string | null | undefined,
): centre is (typeof TERIIP_CENTRES)[number] {
  return centre != null && TERIIP_CENTRES.includes(centre as (typeof TERIIP_CENTRES)[number]);
}

export function canManageTeriipRole(
  actorRole: TeriipRole,
  targetRole: TeriipRole,
  actorCentre: string | null,
  targetCentre: string | null,
) {
  if (actorRole === "super_admin") return targetRole !== "super_admin";
  return (
    actorRole === "centre_admin" &&
    targetRole === "centre_staff" &&
    actorCentre !== null &&
    actorCentre === targetCentre
  );
}

export function centreForWorkspace(
  role: TeriipRole | null,
  assignedCentre: string | null,
  previewCentre: string,
) {
  return role === "centre_admin" || role === "centre_staff"
    ? (assignedCentre ?? "")
    : previewCentre;
}

/** Turns what the person typed (email or temporary username) into the sign-in address. */
export function teriipLoginEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${TEMPORARY_LOGIN_DOMAIN}`;
}

export function isTemporaryLoginEmail(email: string | null | undefined) {
  return Boolean(email && email.toLowerCase().endsWith(`@${TEMPORARY_LOGIN_DOMAIN}`));
}

export function onboardingStage(appMetadata: unknown): OnboardingStage | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;
  const stage = (appMetadata as Record<string, unknown>)["teriip_onboarding"];
  return stage === "email" || stage === "verify_email" || stage === "password" ? stage : null;
}

export function isValidRealEmail(email: string) {
  const value = email.trim().toLowerCase();
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(value) &&
    !isTemporaryLoginEmail(value)
  );
}

export function passwordProblem(password: string, confirm: string) {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`;
  if (password.length > 72) return "Use 72 characters or fewer.";
  if (password !== confirm) return "The passwords do not match.";
  return null;
}

/** Only TERIIP-hosted or local origins may receive account links. */
export function safeAccountLinkOrigin(origin: string | null | undefined) {
  if (!origin) return null;
  const configured = process.env["TERIIP_AUTH_REDIRECT_ORIGINS"]
    ?.split(",")
    .map((value) => value.trim().replace(/\/+$/, ""));
  if (configured?.includes(origin.replace(/\/+$/, ""))) return origin;
  return /^http:\/\/localhost(:\d+)?$/.test(origin) ? origin : null;
}

export function centreSlug(centre: string) {
  return centre
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type TeriipRoutePath =
  "/" | "/upload" | "/activity" | "/admin" | "/settings" | "/manage-users";

const safeAppPaths = new Set<TeriipRoutePath>([
  "/",
  "/upload",
  "/activity",
  "/admin",
  "/settings",
  "/manage-users",
]);

export function safeTeriipReturnPath(value: unknown): TeriipRoutePath {
  if (typeof value !== "string") return "/";
  try {
    const url = new URL(value, "https://teriip.invalid");
    if (
      url.origin !== "https://teriip.invalid" ||
      !safeAppPaths.has(url.pathname as TeriipRoutePath)
    ) {
      return "/";
    }
    return url.pathname as TeriipRoutePath;
  } catch {
    return "/";
  }
}
