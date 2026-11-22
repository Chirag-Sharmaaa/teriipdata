import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createExtractionToken } from "@/lib/extraction-token.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { CENTRE_DATASETS } from "@/lib/drive-datasets";
import { DASHBOARD_CENTRES, resolveDashboardCentre } from "@/lib/dashboard-centres";
import { CENTRE_EXTENSIONS } from "@/lib/teriip-schema";
import { REVIEW_PARAMETERS } from "@/lib/pdf-review-mapping";
import { appendReviewedRecord } from "@/lib/google-sheets-writer.server";
import {
  createGoogleDriveAccessToken,
  GOOGLE_DRIVE_AND_SHEETS_WRITE_SCOPE,
} from "@/lib/google-drive-auth.server";

const ALLOWED_FIELDS = new Set(REVIEW_PARAMETERS.map((parameter) => parameter.name));
type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

const centreInput = z.object({
  centreName: z.string().min(1).max(120),
});

const appendInput = centreInput.extend({
  values: z
    .record(z.string().max(120), z.string().max(2000))
    .refine((values) => Object.keys(values).length <= REVIEW_PARAMETERS.length),
  allowDuplicate: z.boolean().optional(),
});

const EXTRACTOR_CENTRE_KEYS: Record<string, string> = {
  "AIIMS Bathinda": "aiims_bathinda",
  "AIIMS Bhopal": "aiims_bhopal",
  "AIIMS Delhi": "aiims_delhi",
  "AIIMS Jodhpur": "aiims_jodhpur",
  "AIIMS Kalyani": "aiims_kalyani",
  "AIIMS Raipur": "aiims_raipur",
  "NIRRH Port Blair": "nirrh_port_blair",
  "JSS Hospital Mysuru": "jss_mysore",
  "KIMS Bhubaneswar": "kims_bhubaneswar",
  "KMC Manipal": "kmc_manipal",
  "Dr BBCI Guwahati": "bcci_guwahati",
  "KGMU Lucknow": "kgmu_lucknow",
  "P D Hinduja Hospital Mumbai": "pd_hinduja",
};

function isSuperAdmin(role: string) {
  return role === "super_admin";
}

async function getAuthorizedCentre(context: AuthContext, requestedCentreName: string) {
  const { data: role, error: roleError } = await context.supabase
    .from("user_roles")
    .select("role, centre_id, disabled_at")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (roleError || !role || role.disabled_at) {
    throw new Error("Your account is not authorized.");
  }
  if (!["super_admin", "centre_admin", "centre_staff"].includes(role.role)) {
    throw new Error("Your account is not authorized.");
  }
  const { data: active, error: roleCheckError } = await context.supabase.rpc("has_role", {
    _role: role.role,
  });
  if (roleCheckError || !active) throw new Error("Finish your first-login setup first.");

  const centre = isSuperAdmin(role.role)
    ? DASHBOARD_CENTRES.find((profile) => profile.canonicalName === requestedCentreName)
    : resolveDashboardCentre(role.centre_id);
  if (!centre) throw new Error("Choose a valid TERIIP centre.");
  if (!isSuperAdmin(role.role) && centre.canonicalName !== requestedCentreName) {
    throw new Error("You can only access the centre assigned to your account.");
  }
  return { centre, role: role.role };
}

function requireApprovedWorkflow() {
  if (process.env["TERIIP_PARTICIPANT_WORKFLOW_APPROVED"] !== "true") {
    throw new Error(
      "Participant data processing is disabled until institutional privacy and security approval is verified.",
    );
  }
  if (process.env["TERIIP_DRIVE_READS_ENABLED"] !== "true") {
    throw new Error("Google Drive access is disabled. Enable TERIIP_DRIVE_READS_ENABLED first.");
  }
  const email = process.env["TERIIP_GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const privateKey = process.env["TERIIP_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (!email || !privateKey)
    throw new Error("Google service-account credentials are not configured.");
  return { email, privateKey };
}

export const getPdfWorkflowStatus = createServerFn({ method: "GET" })
  .validator(z.object({}).strict())
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role, disabled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleError || !role || role.disabled_at) {
      throw new Error("Your account is not authorized.");
    }
    const { data: active, error: roleCheckError } = await context.supabase.rpc("has_role", {
      _role: role.role,
    });
    if (roleCheckError || !active) throw new Error("Finish your first-login setup first.");

    if (process.env["TERIIP_PARTICIPANT_WORKFLOW_APPROVED"] !== "true") {
      return {
        enabled: false,
        message:
          "Participant processing is disabled until institutional privacy and security approval is verified.",
      };
    }
    if (process.env["TERIIP_DRIVE_READS_ENABLED"] !== "true") {
      return { enabled: false, message: "Google Drive access is disabled." };
    }
    if (
      !process.env["TERIIP_GOOGLE_SERVICE_ACCOUNT_EMAIL"] ||
      !process.env["TERIIP_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"]
    ) {
      return { enabled: false, message: "Google service-account credentials are not configured." };
    }
    return { enabled: true, message: "" };
  });

export const createParticipantExtractionToken = createServerFn({ method: "POST" })
  .validator(centreInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { centre } = await getAuthorizedCentre(context, data.centreName);
    requireApprovedWorkflow();
    const centreKey = EXTRACTOR_CENTRE_KEYS[centre.canonicalName];
    if (!centreKey) throw new Error("Automatic extraction is not available for this centre.");
    const secret = process.env["TERIIP_EXTRACTION_TOKEN_SECRET"];
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error("The extraction token secret is not configured.");
    }
    return { token: createExtractionToken(secret, context.userId, centreKey) };
  });

export const appendReviewedParticipantRecord = createServerFn({ method: "POST" })
  .validator(appendInput)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { centre } = await getAuthorizedCentre(context, data.centreName);
    requireApprovedWorkflow();

    for (const [name, value] of Object.entries(data.values)) {
      if (!ALLOWED_FIELDS.has(name) || typeof value !== "string" || value.length > 2000) {
        throw new Error("The review contains an invalid field value.");
      }
    }
    const recordId = data.values["RecordID"]?.trim();
    if (!recordId) throw new Error("Enter a RecordID before adding this row.");

    const { email, privateKey } = requireApprovedWorkflow();
    const dataset = CENTRE_DATASETS[centre.datasetKey];
    const accessToken = await createGoogleDriveAccessToken(
      email,
      privateKey,
      fetch,
      GOOGLE_DRIVE_AND_SHEETS_WRITE_SCOPE,
    );
    const result = await appendReviewedRecord(
      dataset.fileId,
      data.values,
      accessToken,
      data.allowDuplicate === true,
    );
    if (result.duplicate) {
      return {
        status: "duplicate" as const,
        existingRowNumber: result.existingRowNumber,
        sheetName: result.sheetName,
      };
    }
    return {
      status: "appended" as const,
      rowNumber: result.rowNumber,
      sheetName: result.sheetName,
    };
  });
