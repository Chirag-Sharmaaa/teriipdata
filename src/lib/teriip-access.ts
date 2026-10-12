import { TERIIP_CENTRES } from "@/lib/teriip-schema";

export type TeriipRole = "super_admin" | "centre_admin" | "centre_staff";
export type ManagedRole = Exclude<TeriipRole, "super_admin">;

export function isKnownCentre(centre: string | null | undefined): centre is (typeof TERIIP_CENTRES)[number] {
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

export type TeriipRoutePath =
  | "/"
  | "/upload"
  | "/import"
  | "/activity"
  | "/admin"
  | "/settings"
  | "/manage-users";

const safeAppPaths = new Set<TeriipRoutePath>([
  "/",
  "/upload",
  "/import",
  "/activity",
  "/admin",
  "/settings",
  "/manage-users",
]);

export function safeTeriipReturnPath(value: unknown): TeriipRoutePath {
  if (typeof value !== "string") return "/";
  try {
    const url = new URL(value, "https://teriip.invalid");
     if (!safeAppPaths.has(url.pathname as TeriipRoutePath)) {
      return "/";
    }
    return url.pathname as TeriipRoutePath;
  } catch {
    return "/";
  }
}