import { describe, expect, it } from "vitest";
import {
  buildSheetAppendRow,
  mapExtractorRow,
  mapSheetHeaders,
  normalizeRecordId,
  recordIdFilenameWarning,
} from "@/lib/pdf-review-mapping";
import { COMMON_PARAMETERS } from "@/lib/teriip-schema";

describe("PDF review field mapping", () => {
  it("matches only names with the requested case and separator normalization", () => {
    const result = mapExtractorRow(
      {
        Record_ID: "R-1",
        AGE: 42,
        Blood_Group: "O+",
        Glucose_Fasting: 91,
        Patient_UID: "centre-only-id",
        _Needs_Manual_Review: "AGE",
      },
      true,
    );

    expect(result.values["RecordID"]).toBe("R-1");
    expect(result.values["AGE"]).toBe("42");
    expect(result.values["Blood Group"]).toBe("O+");
    expect(result.values["Glucose_Fasting mg/dl"]).toBe("");
    expect(result.unmatchedExtractorFields).toContain("Glucose_Fasting");
    expect(result.unmatchedExtractorFields).toContain("Patient_UID");
    expect(result.unmappedPageFields).toContain("Glucose_Fasting mg/dl");
    expect(result.manualReviewFields).toContain("AGE");
    expect(result.ocrFields).toContain("AGE");
  });

  it("maps sheet fields by header name, including a one-character typo", () => {
    const headers = COMMON_PARAMETERS.map((parameter) => parameter.name).reverse();
    const recordIdColumn = headers.indexOf("RecordID");
    headers[recordIdColumn] = "Record_ID";
    const bloodGroupColumn = headers.indexOf("Blood Group");
    headers[bloodGroupColumn] = "Blood Groop";
    const mapping = mapSheetHeaders(headers);

    expect(mapping.columnByField.get("RecordID")).toBe(recordIdColumn);
    expect(mapping.columnByField.get("Blood Group")).toBe(bloodGroupColumn);
    expect(mapping.missingFields).toEqual([]);
    expect(mapping.ambiguousFields).toEqual([]);
    const row = buildSheetAppendRow(headers, mapping, { RecordID: "R-2" });
    expect(row[recordIdColumn]).toBe("R-2");
  });

  it("matches the centre sheet's unit-free headers and leaves an empty PBS value blank", () => {
    const headers = [
      "Record_ID",
      "Name",
      "Age",
      "Gender",
      "Hb",
      "PCV",
      "TRBC",
      "MCV",
      "MCH",
      "MCHC",
      "RDW",
      "TLC",
      "Neutrophil",
      "Lymphocyte",
      "Monocyte",
      "Eosinophil",
      "Basophil",
      "Platelet_Count",
      "MPV",
      "Abs_Neutrophil",
      "Abs_Lymphocyte",
      "Abs_Monocyte",
      "Abs_Eosinophil",
      "Abs_Basophil",
      "Reticulocyte",
      "ESR",
      "Glucose_Fasting",
      "HbA1c",
      "Total_Cholesterol",
      "HDL",
      "LDL",
      "Triglycerides",
      "TSH",
      "T3_Total",
      "FT3",
      "T4_Total",
      "FT4",
      "Anti_TPO",
      "Anti_Thyroglobulin",
      "Bilirubin_Total",
      "Bilirubin_Direct",
      "Bilirubin_Indirect",
      "AST",
      "ALT",
      "ALP",
      "GGT",
      "Total_Protein",
      "Albumin",
      "Globulin",
      "Urea",
      "Creatinine",
      "Uric_Acid",
      "Sodium",
      "Potassium",
      "Chloride",
      "Calcium",
      "Phosphorus",
      "Magnesium",
      "Amylase",
      "Lipase",
      "CRP",
      "Iron",
      "Ferritin",
      "TIBC",
      "TFR_Saturation",
      "Vitamin_B12",
      "Vitamin_D",
      "Folate",
      "Copper",
      "Zinc",
      "Blood_Group",
      "PBS",
    ];
    const mapping = mapSheetHeaders(headers);

    expect(mapping.missingFields).toEqual([]);
    expect(mapping.ambiguousFields).toEqual([]);
    const row = buildSheetAppendRow(headers, mapping, {
      RecordID: "R-3",
      "Glucose_Fasting mg/dl": "95",
    });
    expect(row[headers.indexOf("Record_ID")]).toBe("R-3");
    expect(row[headers.indexOf("Glucose_Fasting")]).toBe("95");
    expect(row[headers.indexOf("PBS")]).toBe("");
  });

  it("rejects duplicated destination headers instead of guessing", () => {
    const headers = COMMON_PARAMETERS.map((parameter) => parameter.name);
    headers[1] = "RecordID";
    const mapping = mapSheetHeaders(headers);

    expect(mapping.columnByField.has("RecordID")).toBe(false);
    expect(mapping.ambiguousFields).toContain("RecordID");
  });

  it("normalizes record IDs only for duplicate checks", () => {
    expect(normalizeRecordId("  AbC-123 ")).toBe("abc-123");
  });

  it("warns when a Record ID is empty or differs from the report filename", () => {
    expect(recordIdFilenameWarning("", "CASE-1_Participant.pdf")).toContain("Record ID is empty");
    expect(recordIdFilenameWarning("CASE-2", "CASE-1_Participant.pdf")).toContain(
      'does not match the filename ID "CASE-1"',
    );
    expect(recordIdFilenameWarning("CASE-1", "CASE-1_Participant.pdf")).toBeNull();
    expect(recordIdFilenameWarning("CASE-1", "report.pdf")).toContain("does not look like");
  });
});
