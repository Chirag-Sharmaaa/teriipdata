import { describe, expect, it } from "vitest";
import {
  combineCentreStats,
  createEmptyCentreStats,
  parseMasterTracker,
  parseParticipantSheet,
  scopeCentreAggregates,
} from "@/lib/dashboard-aggregates";
import { DASHBOARD_CENTRES, resolveDashboardCentre } from "@/lib/dashboard-centres";

describe("dashboard centre mapping", () => {
  it("matches canonical centres case-insensitively and ignores punctuation", () => {
    expect(resolveDashboardCentre("AIIMS, Jodhpur")?.canonicalName).toBe("AIIMS Jodhpur");
    expect(resolveDashboardCentre("jss mysore")?.canonicalName).toBe("JSS Hospital Mysuru");
    expect(resolveDashboardCentre("Dr. BBCI Guwahati")?.canonicalName).toBe("Dr BBCI Guwahati");
    expect(resolveDashboardCentre("Unlisted Institute")).toBeUndefined();
  });

  it("matches the institution names used in the live master tracker", () => {
    const trackerNames = [
      ["All India Institute of Medical Sciences, Delhi", "Delhi"],
      ["All India Institute of Medical Sciences, Guwahati", "Guwahati"],
      ["All India Institute of Medical Sciences, Kalyani", "Kalyani"],
      ["All India Institute of Medical Sciences, Bhopal", "AIIMS Bhopal"],
      ["All India Institute of Medical Sciences, Raipur", "Raipur"],
      ["All India Instituxte of Medical Sciences, Bathinda", "Bhatinda"],
      ["Postgraduate Institute of Medical Education & Research", "PGIMER Chandigarh"],
      ["All India Institute of Medical Sciences, Jodhpur", "Jodhpur"],
      ["Dr. B. Borooah Cancer Institute (Regional Cancer Centre)", "BCCI Guwahati"],
      ["ICMR National Institute for Research in Reproductive Health", "NIRRH Port Blair"],
      ["King George Medical University", "KGMU Lucknow"],
      ["Kasturba Medical college", "KMC Manipal"],
      ["JSS Medical college", "JSS Mysore"],
      ["P.D. Hinduja Hospital & Medical Research Centre", "P D Hinduja"],
      ["Kalinga Institute of Medical Sciences", "KIMS Bhubaneswar"],
    ] as const;

    for (const [name, datasetKey] of trackerNames) {
      expect(resolveDashboardCentre(name)?.datasetKey).toBe(datasetKey);
    }
  });
});

describe("master tracker aggregation", () => {
  it("detects a displaced header row, matches typo-tolerant columns, and returns aggregates", () => {
    const rows = [
      ["TERIIP centre master tracker"],
      [
        "S. No.",
        " Institute\nName ",
        "Date of Start",
        "NABL Biochemistry",
        "NABL Haematology",
        "No. of Participants Screened",
        "Total Eligble",
        "Samples collected for blood testing",
        "Rural",
        "Urban",
        "PI Name",
      ],
      [
        1,
        "AIIMS, Jodhpur",
        "13/04/2025",
        "Accredited",
        "Y",
        "1,200",
        800,
        700,
        300,
        400,
        "Ignored",
      ],
      [2, "Unlisted Institute", "-", "No", "No", "text", "-", "-", "-", "-", "Ignored"],
    ];

    const result = parseMasterTracker(rows);
    const jodhpur = result.byCentre.get("Jodhpur");

    expect(result.loaded).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(jodhpur).toEqual({
      startDate: "2025-04-13",
      nablBiochemistry: true,
      nablHematology: true,
      screened: 1200,
      eligible: 800,
      samplesCollected: 700,
      rural: 300,
      urban: 400,
    });
    expect(result.unmatchedRows).toEqual(["Unlisted Institute"]);
    expect(result.centresWithoutRow).toContain("AIIMS Bathinda");
    expect(result.ruralTotal).toBeNull();
    expect(result.urbanTotal).toBeNull();
  });

  it("reports missing required columns and treats nonnumeric tracker values as unavailable", () => {
    const result = parseMasterTracker([
      ["Institute", "Date of Start", "No. of Participants Screened"],
      ["AIIMS Delhi", "2024-06-02", "pending"],
    ]);

    expect(result.warnings).toContain("Column missing: Samples collected for blood testing");
    expect(result.byCentre.get("Delhi")?.screened).toBeNull();
    expect(result.byCentre.get("Delhi")?.samplesCollected).toBeNull();
  });

  it("treats a negative accreditation phrase as No", () => {
    const result = parseMasterTracker([
      ["Institute", "NABL Biochemistry"],
      ["AIIMS Delhi", "Not accredited"],
    ]);
    expect(result.byCentre.get("Delhi")?.nablBiochemistry).toBe(false);
  });
});

describe("participant sheet aggregation", () => {
  it("counts only rows with participant IDs and returns age and gender totals only", () => {
    const result = parseParticipantSheet([
      ["Destination dataset"],
      ["RecordID", "Sex", "Age (years)", "Participant name"],
      ["r1", "M", 25, "Not returned"],
      ["r2", "Female", 26, "Not returned"],
      ["", "Male", 40, "Not returned"],
      ["r3", "unknown value", 72, "Not returned"],
      ["r4", "Other", 70, "Not returned"],
    ]);

    expect(result.recordsInSheet).toBe(4);
    expect(result.genderCounts).toEqual([
      { label: "Female", count: 1 },
      { label: "Male", count: 1 },
      { label: "Other", count: 1 },
      { label: "Unknown", count: 1 },
    ]);
    expect(result.ageCounts).toEqual([
      { label: "18-25", count: 1 },
      { label: "26-35", count: 1 },
      { label: "36-45", count: 0 },
      { label: "46-55", count: 0 },
      { label: "56-65", count: 0 },
      { label: "66-70", count: 1 },
      { label: "70+", count: 1 },
    ]);
    expect(JSON.stringify(result)).not.toContain("Not returned");
  });

  it("marks a sheet without a participant ID column as an error", () => {
    expect(
      parseParticipantSheet([
        ["Name", "Age"],
        ["Private value", 30],
      ]),
    ).toMatchObject({
      recordsInSheet: null,
      sheetError: "Participant ID column not found.",
    });
  });

  it("uses a serial-number column as a record identifier without returning row data", () => {
    const result = parseParticipantSheet([
      ["S.No.", "Name", "Age", "Gender"],
      [1, "Private value", 30, "Female"],
      ["", "Not counted", 40, "Male"],
    ]);

    expect(result.recordsInSheet).toBe(1);
    expect(result.genderCounts?.find((item) => item.label === "Female")?.count).toBe(1);
    expect(result.ageCounts?.find((item) => item.label === "26-35")?.count).toBe(1);
    expect(JSON.stringify(result)).not.toContain("Private value");
  });

  it("returns demographics when IDs are absent but leaves the record count unavailable", () => {
    const result = parseParticipantSheet([
      ["Name", "AGE", "Gender"],
      ["Private value", 30, "Female"],
      ["Another private value", 72, "Male"],
      ["", null, ""],
    ]);

    expect(result.recordsInSheet).toBeNull();
    expect(result.sheetError).toBe("Participant ID column not found.");
    expect(result.genderCounts?.find((item) => item.label === "Female")?.count).toBe(1);
    expect(result.ageCounts?.find((item) => item.label === "70+")?.count).toBe(1);
    expect(JSON.stringify(result)).not.toContain("Private value");
  });
});

describe("combined centre aggregates", () => {
  it("calculates pending entry without returning any participant row values", () => {
    const profile = DASHBOARD_CENTRES[0]!;
    const tracker = {
      startDate: null,
      nablBiochemistry: null,
      nablHematology: null,
      screened: null,
      eligible: null,
      samplesCollected: 9,
      rural: null,
      urban: null,
    };
    const sheet = {
      recordsInSheet: 5,
      genderCounts: [],
      ageCounts: [],
      sheetError: null,
      sheetWarnings: [],
    };

    const result = combineCentreStats(profile, tracker, sheet);
    expect(result.pendingEntry).toBe(4);
    expect(JSON.stringify(result)).not.toContain("participant");
  });

  it("scopes centre-user results and tracker totals to the assigned centre", () => {
    const centres = DASHBOARD_CENTRES.slice(0, 2).map((profile, index) => ({
      ...createEmptyCentreStats(profile),
      tracker: {
        startDate: null,
        nablBiochemistry: null,
        nablHematology: null,
        screened: null,
        eligible: null,
        samplesCollected: null,
        rural: index === 0 ? 5 : 50,
        urban: index === 0 ? 3 : 30,
      },
    }));
    const tracker = {
      configured: true,
      loaded: true,
      error: null,
      warnings: [],
      unmatchedRows: ["Unlisted Institute"],
      centresWithoutRow: ["AIIMS Jodhpur", "AIIMS Bathinda"],
      duplicateRows: ["AIIMS Bathinda"],
      ruralTotal: 55,
      urbanTotal: 33,
    };

    const centreUserResult = scopeCentreAggregates(centres, tracker, "Jodhpur", false);
    expect(centreUserResult.centres.map((centre) => centre.canonicalName)).toEqual([
      "AIIMS Jodhpur",
    ]);
    expect(centreUserResult.tracker.ruralTotal).toBe(5);
    expect(centreUserResult.tracker.urbanTotal).toBe(3);
    expect(centreUserResult.tracker.unmatchedRows).toEqual([]);
    expect(centreUserResult.tracker.centresWithoutRow).toEqual(["AIIMS Jodhpur"]);
    expect(centreUserResult.tracker.duplicateRows).toEqual([]);

    const superAdminResult = scopeCentreAggregates(centres, tracker, null, true);
    expect(superAdminResult.centres).toHaveLength(2);
    expect(superAdminResult.tracker.unmatchedRows).toEqual(["Unlisted Institute"]);
  });
});
