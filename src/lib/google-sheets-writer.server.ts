import {
  buildSheetAppendRow,
  findHeaderRow,
  mapSheetHeaders,
  normalizeRecordId,
  spreadsheetColumnName,
  type ReviewedValues,
} from "@/lib/pdf-review-mapping";
import { COMMON_PARAMETERS, CENTRE_EXTENSIONS } from "@/lib/teriip-schema";

const SHEETS_API = "https://sheets.googleapis.com/v4";
const appendTails = new Map<string, Promise<void>>();

async function sheetsRequest<T>(url: URL, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    const message =
      response.status === 403
        ? "Google Sheets API is disabled or the service account does not have access. Enable the Google Sheets API and check the sheet's Editor permission."
        : response.status === 404
          ? "The destination Google Sheet could not be found or shared with the service account."
          : `Google Sheets request failed (${response.status}).`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function makeValuesUrl(spreadsheetId: string, range: string) {
  return new URL(
    `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
  );
}

async function findDestinationHeaders(
  spreadsheetId: string,
  accessToken: string,
  activeParameters: typeof COMMON_PARAMETERS,
) {
  const metadataUrl = new URL(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}`);
  metadataUrl.searchParams.set("fields", "sheets.properties(sheetId,title)");
  const metadata = await sheetsRequest<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(metadataUrl, accessToken);
  const tabs = (metadata.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
  if (tabs.length === 0) throw new Error("The destination Google Sheet has no readable tabs.");

  const candidates: Array<{
    title: string;
    headers: unknown[];
    headerIndex: number;
    mapping: ReturnType<typeof mapSheetHeaders>;
    score: number;
  }> = [];
  for (const title of tabs) {
    const range = `${quoteSheetName(title)}!A1:ZZ30`;
    const url = makeValuesUrl(spreadsheetId, range);
    url.searchParams.set("majorDimension", "ROWS");
    const result = await sheetsRequest<{ values?: unknown[][] }>(url, accessToken);
    const candidate = findHeaderRow(result.values ?? []);
    if (candidate) {
      candidates.push({
        title,
        headers: result.values![candidate.index] ?? [],
        headerIndex: candidate.index,
        mapping: candidate.mapping,
        score: candidate.score,
      });
    }
  }
  if (candidates.length === 0) {
    throw new Error("No destination tab has a recognizable TERIIP field header row.");
  }
  candidates.sort((left, right) => right.score - left.score);
  if (candidates.length > 1 && candidates[0]!.score === candidates[1]!.score) {
    throw new Error("More than one destination tab matches the TERIIP field headers.");
  }
  const selected = candidates[0]!;
  const requiredNames = new Set(activeParameters.map((parameter) => parameter.name));
  const missingFields = selected.mapping.missingFields.filter((name) => requiredNames.has(name));
  const ambiguousFields = selected.mapping.ambiguousFields.filter((name) =>
    requiredNames.has(name),
  );
  if (missingFields.length || ambiguousFields.length) {
    throw new Error(
      `Destination sheet headers need review. Missing: ${missingFields.join(", ") || "none"}. Ambiguous: ${ambiguousFields.join(", ") || "none"}.`,
    );
  }
  selected.mapping = mapSheetHeaders(selected.headers, activeParameters);
  return selected;
}

async function withAppendLock<T>(key: string, action: () => Promise<T>) {
  const previous = appendTails.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  appendTails.set(key, tail);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (appendTails.get(key) === tail) appendTails.delete(key);
  }
}

export async function appendReviewedRecord(
  spreadsheetId: string,
  values: ReviewedValues,
  accessToken: string,
  allowDuplicate = false,
) {
  return withAppendLock(spreadsheetId, async () => {
    const activeExtensions = CENTRE_EXTENSIONS.filter((parameter) =>
      Boolean(values[parameter.name]?.trim()),
    );
    const activeParameters = [...COMMON_PARAMETERS, ...activeExtensions];
    const destination = await findDestinationHeaders(spreadsheetId, accessToken, activeParameters);
    const idColumn = destination.mapping.columnByField.get("RecordID");
    if (idColumn === undefined) throw new Error("The destination sheet has no RecordID column.");

    const idColumnName = spreadsheetColumnName(idColumn);
    const idRange = `${quoteSheetName(destination.title)}!${idColumnName}${destination.headerIndex + 2}:${idColumnName}`;
    const idResult = await sheetsRequest<{ values?: unknown[][] }>(
      makeValuesUrl(spreadsheetId, idRange),
      accessToken,
    );
    const wantedId = normalizeRecordId(values["RecordID"]);
    const duplicateIndex = (idResult.values ?? []).findIndex(
      (row) => normalizeRecordId(row[0]) === wantedId,
    );
    if (duplicateIndex !== -1 && !allowDuplicate) {
      return {
        duplicate: true as const,
        existingRowNumber: destination.headerIndex + 2 + duplicateIndex,
        sheetName: destination.title,
      };
    }

    const row = buildSheetAppendRow(
      destination.headers,
      destination.mapping,
      values,
      activeParameters,
    );
    const range = `${quoteSheetName(destination.title)}!A${destination.headerIndex + 1}`;
    const appendUrl = new URL(
      `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append`,
    );
    appendUrl.searchParams.set("valueInputOption", "RAW");
    appendUrl.searchParams.set("insertDataOption", "INSERT_ROWS");
    appendUrl.searchParams.set("includeValuesInResponse", "false");
    const result = await sheetsRequest<{
      updates?: { updatedRange?: string };
    }>(appendUrl, accessToken, {
      method: "POST",
      body: JSON.stringify({ values: [row] }),
    });
    const rowNumber = result.updates?.updatedRange?.match(/!(?:.*?)(\d+)(?::.*)?$/)?.[1];
    if (!rowNumber) throw new Error("The sheet did not confirm the appended row number.");
    return {
      duplicate: false as const,
      rowNumber: Number(rowNumber),
      sheetName: destination.title,
    };
  });
}
