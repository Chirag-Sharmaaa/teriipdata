import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CENTRE_DATASETS } from "@/lib/drive-datasets";
import {
  combineCentreStats,
  createEmptyCentreStats,
  createEmptyMasterTracker,
  parseMasterTracker,
  parseParticipantSheet,
  scopeCentreAggregates,
  type CentreDashboardStats,
  type MasterTrackerStats,
} from "@/lib/dashboard-aggregates";
import { DASHBOARD_CENTRES, resolveDashboardCentre } from "@/lib/dashboard-centres";
import { DashboardTtlCache } from "@/lib/dashboard-cache";
import { createGoogleDriveAccessToken } from "@/lib/google-drive-auth.server";
import { readDriveWorkbook } from "@/lib/google-drive-reader.server";

const dashboardCache = new DashboardTtlCache<DashboardSnapshot>(10 * 60 * 1000);

export type DashboardStatsResult = {
  connected: boolean;
  status: "disabled" | "missing_credentials" | "connected";
  centres: CentreDashboardStats[];
  tracker: MasterTrackerStats;
  fetchedAt: string | null;
};

type DashboardSnapshot = Omit<DashboardStatsResult, "connected" | "status">;

function emptySnapshot(): DashboardSnapshot {
  return {
    centres: DASHBOARD_CENTRES.map(createEmptyCentreStats),
    tracker: createEmptyMasterTracker(
      Boolean(process.env["MASTER_TRACKER_SHEET_ID"] && process.env["MASTER_TRACKER_TAB"]),
    ),
    fetchedAt: null,
  };
}

function withTrackerError(tracker: MasterTrackerStats, error: string): MasterTrackerStats {
  return {
    ...tracker,
    error,
  };
}

async function loadDashboardSnapshot(
  accessToken: string,
  masterSheetId: string | undefined,
  masterTab: string | undefined,
): Promise<DashboardSnapshot> {
  const trackerConfigured = Boolean(masterSheetId && masterTab);
  const trackerRead = trackerConfigured
    ? readDriveWorkbook(
        { fileId: masterSheetId!, googleSheet: true, worksheetName: masterTab! },
        accessToken,
      )
        .then(({ rows }) => {
          const parsed = parseMasterTracker(rows);
          const { byCentre, ...tracker } = parsed;
          return { byCentre, tracker: { ...tracker, configured: true } };
        })
        .catch((error: unknown) => {
          console.error(
            "Master tracker read failed:",
            error instanceof Error ? error.message : "Unknown error.",
          );
          return {
            byCentre: new Map(),
            tracker: withTrackerError(
              createEmptyMasterTracker(true),
              "Master tracker sheet could not be read.",
            ),
          };
        })
    : Promise.resolve({
        byCentre: new Map(),
        tracker: withTrackerError(
          createEmptyMasterTracker(false),
          "Configure MASTER_TRACKER_SHEET_ID and MASTER_TRACKER_TAB on the server.",
        ),
      });

  const centreReads = DASHBOARD_CENTRES.map(async (profile) => {
    const dataset = CENTRE_DATASETS[profile.datasetKey];
    try {
      const { rows } = await readDriveWorkbook(dataset, accessToken);
      return { profile, sheet: parseParticipantSheet(rows), sheetError: null };
    } catch (error) {
      console.error(
        `Drive read failed for ${profile.canonicalName}:`,
        error instanceof Error ? error.message : "Unknown error.",
      );
      return {
        profile,
        sheet: parseParticipantSheet([]),
        sheetError: "Sheet error",
      };
    }
  });

  const [trackerResult, sheets] = await Promise.all([trackerRead, Promise.all(centreReads)]);
  const centres = sheets.map(({ profile, sheet, sheetError }) => {
    const stats = combineCentreStats(
      profile,
      trackerResult.byCentre.get(profile.datasetKey),
      sheet,
    );
    if (sheetError) stats.sheetError = sheetError;
    return stats;
  });

  return {
    centres,
    tracker: trackerResult.tracker,
    fetchedAt: new Date().toISOString(),
  };
}

function scopeDashboardResult(
  snapshot: DashboardSnapshot,
  centreKey: CentreDashboardStats["datasetKey"] | null,
  isSuperAdmin: boolean,
): DashboardStatsResult {
  const scoped = scopeCentreAggregates(snapshot.centres, snapshot.tracker, centreKey, isSuperAdmin);
  return {
    ...snapshot,
    connected: snapshot.fetchedAt !== null,
    status: snapshot.fetchedAt !== null ? "connected" : "disabled",
    ...scoped,
  };
}

export const getDriveStats = createServerFn({ method: "GET" })
  .validator(z.object({ forceRefresh: z.boolean().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role, centre_id, disabled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!role || role.disabled_at) throw new Error("Your account is not authorized.");
    const { data: active } = await context.supabase.rpc("has_role", { _role: role.role });
    if (!active) throw new Error("Finish your first-login setup first.");

    const isSuperAdmin = role.role === "super_admin";
    const assignedCentre = isSuperAdmin ? undefined : resolveDashboardCentre(role.centre_id);
    if (!isSuperAdmin && !assignedCentre)
      throw new Error("Your account has no valid centre access.");

    if (process.env["TERIIP_DRIVE_READS_ENABLED"] !== "true") {
      const snapshot = emptySnapshot();
      return {
        ...snapshot,
        connected: false,
        status: "disabled",
        centres: isSuperAdmin
          ? snapshot.centres
          : snapshot.centres.filter((centre) => centre.datasetKey === assignedCentre!.datasetKey),
      } satisfies DashboardStatsResult;
    }

    const serviceAccountEmail = process.env["TERIIP_GOOGLE_SERVICE_ACCOUNT_EMAIL"];
    const serviceAccountPrivateKey = process.env["TERIIP_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];
    if (!serviceAccountEmail || !serviceAccountPrivateKey) {
      const snapshot = emptySnapshot();
      return {
        ...snapshot,
        connected: false,
        status: "missing_credentials",
        centres: isSuperAdmin
          ? snapshot.centres
          : snapshot.centres.filter((centre) => centre.datasetKey === assignedCentre!.datasetKey),
      } satisfies DashboardStatsResult;
    }

    const masterSheetId = process.env["MASTER_TRACKER_SHEET_ID"];
    const masterTab = process.env["MASTER_TRACKER_TAB"];
    const cacheKey = `${serviceAccountEmail}|${masterSheetId ?? ""}|${masterTab ?? ""}`;
    const snapshot = await dashboardCache.get(cacheKey, data.forceRefresh === true, async () => {
      const accessToken = await createGoogleDriveAccessToken(
        serviceAccountEmail,
        serviceAccountPrivateKey,
      );
      return loadDashboardSnapshot(accessToken, masterSheetId, masterTab);
    });
    return scopeDashboardResult(
      snapshot,
      assignedCentre?.datasetKey ?? null,
      isSuperAdmin,
    ) satisfies DashboardStatsResult;
  });
