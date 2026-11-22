import { COMMON_PARAMETERS, CENTRE_EXTENSIONS, type Parameter } from "@/lib/teriip-schema";

export type ReviewedValues = Record<string, string>;

export type ExtractedFieldMapping = {
  values: ReviewedValues;
  unmatchedExtractorFields: string[];
  unmappedPageFields: string[];
  manualReviewFields: string[];
  ocrFields: string[];
};
export const REVIEW_PARAMETERS = [...COMMON_PARAMETERS, ...CENTRE_EXTENSIONS];

function normalizeExtractorName(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, "");
}

function normalizeSheetHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeParameterSheetNames(parameter: Parameter) {
  const unit = parameter.unit?.trim();
  const baseName =
    unit && parameter.name.toLowerCase().endsWith(unit.toLowerCase())
      ? parameter.name.slice(0, -unit.length).trimEnd()
      : parameter.name;
  return [baseName, parameter.name, ...(parameter.aliases ?? [])].map(normalizeSheetHeader);
}

function editDistanceAtMostOne(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex++;
      rightIndex++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex++;
    else if (right.length > left.length) rightIndex++;
    else {
      leftIndex++;
      rightIndex++;
    }
  }
  if (leftIndex < left.length || rightIndex < right.length) edits++;
  return edits <= 1;
}

function matchParameterName(sourceName: string, parameters: Parameter[] = REVIEW_PARAMETERS) {
  const normalized = normalizeExtractorName(sourceName);
  return parameters.filter((parameter) =>
    [parameter.name, ...(parameter.aliases ?? [])].some(
      (name) => normalizeExtractorName(name) === normalized,
    ),
  );
}

function toFieldValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function mapExtractorRow(
  row: Record<string, unknown>,
  ocrUsed: boolean,
  parameters: Parameter[] = COMMON_PARAMETERS,
): ExtractedFieldMapping {
  const values: ReviewedValues = Object.fromEntries(
    parameters.map((parameter) => [parameter.name, ""]),
  );
  const candidateKeys = new Map<string, string[]>();
  const unmatchedExtractorFields: string[] = [];

  for (const sourceName of Object.keys(row)) {
    if (sourceName === "_Needs_Manual_Review") continue;
    const matches = matchParameterName(sourceName, parameters);
    if (matches.length !== 1) {
      unmatchedExtractorFields.push(sourceName);
      continue;
    }
    const pageName = matches[0]!.name;
    candidateKeys.set(pageName, [...(candidateKeys.get(pageName) ?? []), sourceName]);
  }

  const ocrFields: string[] = [];
  for (const [pageName, sourceNames] of candidateKeys) {
    if (sourceNames.length !== 1) {
      unmatchedExtractorFields.push(...sourceNames);
      continue;
    }
    const sourceName = sourceNames[0]!;
    const value = toFieldValue(row[sourceName]);
    values[pageName] = value;
    if (ocrUsed && value !== "") ocrFields.push(pageName);
    if (value.includes("===OCR_PAGE===") && !ocrFields.includes(pageName)) {
      ocrFields.push(pageName);
    }
  }

  const reviewNames = String(row["_Needs_Manual_Review"] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const manualReviewFields = [
    ...new Set(
      reviewNames.flatMap((name) =>
        matchParameterName(name, parameters).map((parameter) => parameter.name),
      ),
    ),
  ];
  const mappedNames = new Set(
    [...candidateKeys.entries()].filter(([, keys]) => keys.length === 1).map(([name]) => name),
  );

  return {
    values,
    unmatchedExtractorFields: [...new Set(unmatchedExtractorFields)].sort(),
    unmappedPageFields: parameters
      .map((parameter) => parameter.name)
      .filter((name) => !mappedNames.has(name)),
    manualReviewFields,
    ocrFields,
  };
}

export type SheetHeaderMapping = {
  columnByField: Map<string, number>;
  missingFields: string[];
  ambiguousFields: string[];
};

export function mapSheetHeaders(
  headers: unknown[],
  parameters: Parameter[] = COMMON_PARAMETERS,
): SheetHeaderMapping {
  const headerNames = headers.map((header) => String(header ?? "").trim());
  const columnByField = new Map<string, number>();
  const missingFields: string[] = [];
  const ambiguousFields: string[] = [];
  const usedColumns = new Map<number, string>();

  for (const parameter of parameters) {
    const parameterNames = normalizeParameterSheetNames(parameter);
    const exact = headerNames.flatMap((header, index) =>
      parameterNames.includes(normalizeSheetHeader(header)) ? [index] : [],
    );
    let candidates = exact;
    if (candidates.length === 0) {
      candidates = headerNames.flatMap((header, index) => {
        const candidate = normalizeSheetHeader(header);
        if (candidate.length < 6) return [];
        return parameterNames.some(
          (name) => name.length >= 6 && editDistanceAtMostOne(candidate, name),
        )
          ? [index]
          : [];
      });
    }
    if (candidates.length !== 1) {
      (candidates.length === 0 ? missingFields : ambiguousFields).push(parameter.name);
      continue;
    }
    const column = candidates[0]!;
    const otherField = usedColumns.get(column);
    if (otherField) {
      columnByField.delete(otherField);
      ambiguousFields.push(otherField, parameter.name);
      continue;
    }
    usedColumns.set(column, parameter.name);
    columnByField.set(parameter.name, column);
  }

  return {
    columnByField,
    missingFields: [...new Set(missingFields)],
    ambiguousFields: [...new Set(ambiguousFields)],
  };
}

export function findHeaderRow(rows: unknown[][], parameters: Parameter[] = COMMON_PARAMETERS) {
  let best: { index: number; mapping: SheetHeaderMapping; score: number } | undefined;
  for (let index = 0; index < Math.min(rows.length, 30); index++) {
    const mapping = mapSheetHeaders(rows[index] ?? [], parameters);
    const score = mapping.columnByField.size;
    if (score > (best?.score ?? 0)) best = { index, mapping, score };
  }
  if (!best || !best.mapping.columnByField.has("RecordID") || best.score < 8) return undefined;
  return best;
}

export function buildSheetAppendRow(
  headers: unknown[],
  mapping: SheetHeaderMapping,
  values: ReviewedValues,
  parameters: Parameter[] = COMMON_PARAMETERS,
) {
  const requiredNames = new Set(COMMON_PARAMETERS.map((parameter) => parameter.name));
  const activeNames = new Set(parameters.map((parameter) => parameter.name));
  const missingRequired = mapping.missingFields.filter((name) => requiredNames.has(name));
  const ambiguousRequired = mapping.ambiguousFields.filter((name) => requiredNames.has(name));
  if (missingRequired.length || ambiguousRequired.length) {
    throw new Error("The destination sheet headers do not match the review fields.");
  }
  const row = Array.from({ length: headers.length }, () => "");
  for (const parameter of parameters) {
    if (!activeNames.has(parameter.name)) continue;
    const column = mapping.columnByField.get(parameter.name);
    if (column === undefined) {
      if (requiredNames.has(parameter.name) || values[parameter.name]?.trim()) {
        throw new Error("The destination sheet is missing a required field.");
      }
      continue;
    }
    row[column] = values[parameter.name] ?? "";
  }
  return row;
}

export function spreadsheetColumnName(columnIndex: number) {
  let value = columnIndex + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

export function normalizeRecordId(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

export function recordIdFilenameWarning(recordId: string, fileName: string | null) {
  const normalizedRecordId = normalizeRecordId(recordId);
  if (!normalizedRecordId) {
    return "Record ID is empty. Enter the ID from the report filename before confirming.";
  }
  if (!fileName) return null;

  const extension = fileName.toLowerCase().endsWith(".csv") ? ".csv" : ".pdf";
  const stem = fileName.toLowerCase().endsWith(extension)
    ? fileName.slice(0, -extension.length)
    : fileName;
  const separator = stem.indexOf("_");
  if (separator <= 0 || separator === stem.length - 1) {
    const example =
      extension === ".csv" ? "RecordID_ParticipantName.csv" : "RecordID_ParticipantName.pdf";
    return `The filename does not look like ${example}. Check the Record ID before continuing.`;
  }

  const fileRecordId = stem.slice(0, separator).trim();
  if (normalizeRecordId(fileRecordId) !== normalizedRecordId) {
    return `Record ID "${recordId.trim()}" does not match the filename ID "${fileRecordId}". Check it before continuing.`;
  }
  return null;
}
