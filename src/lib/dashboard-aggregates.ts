import {
  DASHBOARD_CENTRES,
  resolveDashboardCentre,
  type DashboardCentreProfile,
} from "@/lib/dashboard-centres";

export const AGE_BINS = [
  { label: "18-25", min: 18, max: 25 },
  { label: "26-35", min: 26, max: 35 },
  { label: "36-45", min: 36, max: 45 },
  { label: "46-55", min: 46, max: 55 },
  { label: "56-65", min: 56, max: 65 },
  { label: "66-70", min: 66, max: 70 },
  { label: "70+", min: 71, max: Number.POSITIVE_INFINITY },
] as const;

export type TrackerField =
  | "institute"
  | "startDate"
  | "nablBiochemistry"
  | "nablHematology"
  | "screened"
  | "eligible"
  | "samplesCollected"
  | "rural"
  | "urban";

export type CentreTrackerStats = {
  startDate: string | null;
  nablBiochemistry: boolean | null;
  nablHematology: boolean | null;
  screened: number | null;
  eligible: number | null;
  samplesCollected: number | null;
  rural: number | null;
  urban: number | null;
};

export type CountItem = { label: string; count: number };

export type CentreDashboardStats = {
  canonicalName: string;
  datasetKey: DashboardCentreProfile["datasetKey"];
  region: string;
  tier: string;
  target: number;
  latitude: number;
  longitude: number;
  trackerRowFound: boolean;
  tracker: CentreTrackerStats;
  recordsInSheet: number | null;
  genderCounts: CountItem[] | null;
  ageCounts: CountItem[] | null;
  sheetError: string | null;
  sheetWarnings: string[];
  completion: number | null;
  pendingEntry: number | null;
};

export type MasterTrackerStats = {
  configured: boolean;
  loaded: boolean;
  error: string | null;
  warnings: string[];
  unmatchedRows: string[];
  centresWithoutRow: string[];
  duplicateRows: string[];
  ruralTotal: number | null;
  urbanTotal: number | null;
};

const FIELD_LABELS: Record<TrackerField, string> = {
  institute: "Institute",
  startDate: "Date of Start",
  nablBiochemistry: "NABL Biochemistry",
  nablHematology: "NABL Hematology",
  screened: "No. of Participants Screened",
  eligible: "Eligible",
  samplesCollected: "Samples collected for blood testing",
  rural: "Rural",
  urban: "Urban",
};

const TRACKER_FIELDS = Object.keys(FIELD_LABELS) as TrackerField[];

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesTrackerHeader(field: TrackerField, header: string) {
  switch (field) {
    case "institute":
      return header.includes("institute");
    case "startDate":
      return header.includes("date of start");
    case "nablBiochemistry":
      return header.includes("nabl") && header.includes("biochem");
    case "nablHematology":
      return header.includes("nabl") && /(ha?emat)/.test(header);
    case "screened":
      return header.includes("participants screened");
    case "eligible":
      return header.includes("eligible") || header.includes("eligble");
    case "samplesCollected":
      return header.includes("samples collected for blood testing");
    case "rural":
      return header.includes("rural");
    case "urban":
      return header.includes("urban");
  }
}

function findTrackerHeader(rows: unknown[][]) {
  let bestIndex = -1;
  let bestColumns: Partial<Record<TrackerField, number>> = {};
  let bestScore = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const columns: Partial<Record<TrackerField, number>> = {};
    for (const field of TRACKER_FIELDS) {
      const index = row.findIndex((value) => matchesTrackerHeader(field, normalizeHeader(value)));
      if (index >= 0) columns[field] = index;
    }
    const score = Object.keys(columns).length;
    if (score > bestScore) {
      bestIndex = rowIndex;
      bestColumns = columns;
      bestScore = score;
    }
  }
  return { index: bestIndex, columns: bestColumns };
}

function getCell(row: unknown[] | undefined, index: number | undefined) {
  return index === undefined ? undefined : row?.[index];
}

function parseCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
  }
  if (value === null || value === undefined) return 0;
  const text = String(value).trim();
  if (!text || text === "-") return 0;
  const numeric = Number(text.replace(/,/g, ""));
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : null;
}

function parseYes(value: unknown): boolean {
  const text = normalizeHeader(value);
  if (text.includes("notaccredit")) return false;
  return (
    ["yes", "y", "true", "t", "1", "accredited", "nablaccredited"].includes(text) ||
    (text.includes("accredit") && !text.includes("not"))
  );
}

function formatDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseTrackerDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86_400_000);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
  }
  const text = String(value ?? "").trim();
  if (!text || text === "-") return null;
  const numericDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    let year = Number(numericDate[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (first > 12) return formatDate(year, second, first);
    if (second > 12) return formatDate(year, first, second);
    return formatDate(year, second, first);
  }
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function emptyTracker(): CentreTrackerStats {
  return {
    startDate: null,
    nablBiochemistry: null,
    nablHematology: null,
    screened: null,
    eligible: null,
    samplesCollected: null,
    rural: null,
    urban: null,
  };
}

export function parseMasterTracker(rows: unknown[][]) {
  const { index: headerIndex, columns } = findTrackerHeader(rows);
  const warnings = TRACKER_FIELDS.filter((field) => columns[field] === undefined).map(
    (field) => `Column missing: ${FIELD_LABELS[field]}`,
  );
  const byCentre = new Map<string, CentreTrackerStats>();
  const unmatchedRows = new Set<string>();
  const duplicateRows = new Set<string>();
  const rowCounts = new Map<string, number>();

  if (headerIndex >= 0 && columns.institute !== undefined) {
    for (const row of rows.slice(headerIndex + 1)) {
      const rawName = String(getCell(row, columns.institute) ?? "").trim();
      if (!rawName) continue;
      const profile = resolveDashboardCentre(rawName);
      if (!profile) {
        unmatchedRows.add(rawName);
        continue;
      }
      const key = profile.datasetKey;
      const seen = (rowCounts.get(key) ?? 0) + 1;
      rowCounts.set(key, seen);
      if (seen > 1) {
        duplicateRows.add(profile.canonicalName);
        continue;
      }

      const readNumber = (field: TrackerField) =>
        columns[field] === undefined ? null : parseCount(getCell(row, columns[field]));
      const readYesNo = (field: TrackerField) =>
        columns[field] === undefined ? null : parseYes(getCell(row, columns[field]));
      byCentre.set(key, {
        startDate:
          columns.startDate === undefined
            ? null
            : parseTrackerDate(getCell(row, columns.startDate)),
        nablBiochemistry: readYesNo("nablBiochemistry"),
        nablHematology: readYesNo("nablHematology"),
        screened: readNumber("screened"),
        eligible: readNumber("eligible"),
        samplesCollected: readNumber("samplesCollected"),
        rural: readNumber("rural"),
        urban: readNumber("urban"),
      });
    }
  }

  const centresWithoutRow =
    headerIndex >= 0 && columns.institute !== undefined
      ? DASHBOARD_CENTRES.filter((centre) => !byCentre.has(centre.datasetKey)).map(
          (centre) => centre.canonicalName,
        )
      : [];
  const completeTotal = (field: "rural" | "urban") => {
    if (centresWithoutRow.length > 0 || columns[field] === undefined) return null;
    let sum = 0;
    for (const centre of DASHBOARD_CENTRES) {
      const value = byCentre.get(centre.datasetKey)?.[field];
      if (value === null || value === undefined) return null;
      sum += value;
    }
    return sum;
  };

  return {
    loaded: headerIndex >= 0,
    error: headerIndex < 0 ? "Could not identify the master tracker header row." : null,
    warnings,
    unmatchedRows: [...unmatchedRows],
    centresWithoutRow,
    duplicateRows: [...duplicateRows],
    ruralTotal: completeTotal("rural"),
    urbanTotal: completeTotal("urban"),
    byCentre,
  };
}

function headerKind(header: string, kind: "id" | "gender" | "age") {
  if (kind === "gender") return header.includes("gender") || header.includes("sex");
  if (kind === "age") return header === "age" || header.startsWith("age ");
  const compact = header.replace(/[^a-z0-9]/g, "");
  return /^(recordid|serialno|sno|participant(id|no|number|code)|subject(id|no|number|code))/.test(
    compact,
  );
}

function findParticipantHeader(rows: unknown[][]) {
  let bestIndex = -1;
  let bestColumns = { id: -1, gender: -1, age: -1 };
  let bestScore = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const columns = {
      id: row.findIndex((value) => headerKind(normalizeHeader(value), "id")),
      gender: row.findIndex((value) => headerKind(normalizeHeader(value), "gender")),
      age: row.findIndex((value) => headerKind(normalizeHeader(value), "age")),
    };
    if (columns.id < 0 && columns.gender < 0 && columns.age < 0) continue;
    const score =
      Number(columns.id >= 0) * 10 + Number(columns.gender >= 0) * 2 + Number(columns.age >= 0) * 2;
    if (score > bestScore) {
      bestIndex = rowIndex;
      bestColumns = columns;
      bestScore = score;
    }
  }
  return { index: bestIndex, columns: bestColumns };
}

function parseAge(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text || text === "-") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function normalizeGender(value: unknown) {
  const text = normalizeHeader(value);
  if (text === "m" || text === "male" || text === "man") return "Male";
  if (text === "f" || text === "female" || text === "woman") return "Female";
  if (text.includes("nonbinary") || text === "other") return "Other";
  return "Unknown";
}

export function parseParticipantSheet(rows: unknown[][]) {
  const { index: headerIndex, columns } = findParticipantHeader(rows);
  const sheetWarnings: string[] = [];
  if (headerIndex < 0) {
    return {
      recordsInSheet: null,
      genderCounts: null,
      ageCounts: null,
      sheetError: "Participant ID column not found.",
      sheetWarnings,
    };
  }

  if (columns.gender < 0) sheetWarnings.push("Column missing: Gender or Sex");
  if (columns.age < 0) sheetWarnings.push("Column missing: Age");

  let recordsInSheet = 0;
  const genders = new Map<string, number>([
    ["Female", 0],
    ["Male", 0],
    ["Other", 0],
    ["Unknown", 0],
  ]);
  const ages = AGE_BINS.map((bin) => ({ label: bin.label, count: 0 }));
  const hasParticipantId = columns.id >= 0;
  for (const row of rows.slice(headerIndex + 1)) {
    const participantId = getCell(row, columns.id);
    if (hasParticipantId) {
      if (participantId === null || participantId === undefined || !String(participantId).trim()) {
        continue;
      }
      recordsInSheet += 1;
    } else {
      const hasGender =
        columns.gender >= 0 && Boolean(String(getCell(row, columns.gender) ?? "").trim());
      const hasAge = columns.age >= 0 && parseAge(getCell(row, columns.age)) !== null;
      if (!hasGender && !hasAge) continue;
    }
    if (columns.gender >= 0) {
      const gender = normalizeGender(getCell(row, columns.gender));
      genders.set(gender, (genders.get(gender) ?? 0) + 1);
    }
    if (columns.age >= 0) {
      const age = parseAge(getCell(row, columns.age));
      if (age === null) continue;
      const index = AGE_BINS.findIndex((bin) => age >= bin.min && age <= bin.max);
      if (index >= 0) ages[index]!.count += 1;
    }
  }

  return {
    recordsInSheet: hasParticipantId ? recordsInSheet : null,
    genderCounts:
      columns.gender >= 0 ? [...genders].map(([label, count]) => ({ label, count })) : null,
    ageCounts: columns.age >= 0 ? ages : null,
    sheetError: hasParticipantId ? null : "Participant ID column not found.",
    sheetWarnings,
  };
}

export function createEmptyCentreStats(profile: DashboardCentreProfile): CentreDashboardStats {
  return {
    canonicalName: profile.canonicalName,
    datasetKey: profile.datasetKey,
    region: profile.region,
    tier: profile.tier,
    target: profile.target,
    latitude: profile.latitude,
    longitude: profile.longitude,
    trackerRowFound: false,
    tracker: emptyTracker(),
    recordsInSheet: null,
    genderCounts: null,
    ageCounts: null,
    sheetError: null,
    sheetWarnings: [],
    completion: null,
    pendingEntry: null,
  };
}

export function combineCentreStats(
  profile: DashboardCentreProfile,
  tracker: CentreTrackerStats | undefined,
  sheet: ReturnType<typeof parseParticipantSheet>,
): CentreDashboardStats {
  const stats = createEmptyCentreStats(profile);
  if (tracker) {
    stats.trackerRowFound = true;
    stats.tracker = tracker;
  }
  stats.recordsInSheet = sheet.recordsInSheet;
  stats.genderCounts = sheet.genderCounts;
  stats.ageCounts = sheet.ageCounts;
  stats.sheetError = sheet.sheetError;
  stats.sheetWarnings = sheet.sheetWarnings;
  if (tracker?.samplesCollected !== null && tracker?.samplesCollected !== undefined) {
    stats.completion = Math.round((tracker.samplesCollected / profile.target) * 100);
    if (sheet.recordsInSheet !== null) {
      stats.pendingEntry = Math.max(0, tracker.samplesCollected - sheet.recordsInSheet);
    }
  }
  return stats;
}

export function createEmptyMasterTracker(configured: boolean): MasterTrackerStats {
  return {
    configured,
    loaded: false,
    error: null,
    warnings: [],
    unmatchedRows: [],
    centresWithoutRow: [],
    duplicateRows: [],
    ruralTotal: null,
    urbanTotal: null,
  };
}

export function scopeCentreAggregates(
  centres: CentreDashboardStats[],
  tracker: MasterTrackerStats,
  centreKey: CentreDashboardStats["datasetKey"] | null,
  isSuperAdmin: boolean,
) {
  if (isSuperAdmin) return { centres, tracker };
  const scopedCentres = centres.filter((centre) => centre.datasetKey === centreKey);
  const centreNames = new Set(scopedCentres.map((centre) => centre.canonicalName));
  return {
    centres: scopedCentres,
    tracker: {
      ...tracker,
      ruralTotal: scopedCentres[0]?.tracker.rural ?? null,
      urbanTotal: scopedCentres[0]?.tracker.urban ?? null,
      unmatchedRows: [],
      centresWithoutRow: tracker.centresWithoutRow.filter((name) => centreNames.has(name)),
      duplicateRows: tracker.duplicateRows.filter((name) => centreNames.has(name)),
    },
  };
}
