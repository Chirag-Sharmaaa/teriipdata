import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CENTRE_DATASETS, summariseRows, type CentreStats } from "@/lib/drive-datasets";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function readCentre(centre: keyof typeof CENTRE_DATASETS, headers: HeadersInit): Promise<CentreStats> {
  const ds = CENTRE_DATASETS[centre];
  const base = { centre, fileName: ds.fileName, records: null, completeness: null, modifiedTime: null };
  try {
    const meta = await fetch(`${GATEWAY}/files/${ds.fileId}?fields=modifiedTime`, { headers });
    if (!meta.ok) throw new Error(`Drive ${meta.status}: ${await meta.text()}`);
    const { modifiedTime } = (await meta.json()) as { modifiedTime?: string };
    const url = ds.googleSheet
      ? `${GATEWAY}/files/${ds.fileId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`
      : `${GATEWAY}/files/${ds.fileId}?alt=media`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text()}`);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    const rows = sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][]) : [];
    return { ...base, ...summariseRows(rows), modifiedTime: modifiedTime ?? null, error: null };
  } catch (e) {
    console.error(`Drive read failed for ${centre}:`, e);
    return { ...base, error: "Could not read this centre's dataset from Drive." };
  }
}

/** Live record counts from each centre's Drive dataset; centre accounts only see their own centre. */
export const getDriveStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role, centre_id, disabled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!role || role.disabled_at) throw new Error("Your account is not authorized.");
    const { data: active } = await context.supabase.rpc("has_role", { _role: role.role });
    if (!active) throw new Error("Finish your first-login setup first.");

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
    if (!lovableKey || !driveKey) return { connected: false, centres: [] as CentreStats[] };
    const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey };

    const all = Object.keys(CENTRE_DATASETS) as (keyof typeof CENTRE_DATASETS)[];
    const allowed =
      role.role === "super_admin" ? all : all.filter((c) => c === role.centre_id);
    const centres = await Promise.all(allowed.map((c) => readCentre(c, headers)));
    return { connected: true, centres, fetchedAt: new Date().toISOString() };
  });
