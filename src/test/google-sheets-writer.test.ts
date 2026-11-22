// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { appendReviewedRecord } from "@/lib/google-sheets-writer.server";
import { COMMON_PARAMETERS } from "@/lib/teriip-schema";

const headers = COMMON_PARAMETERS.map((parameter) => {
  const { name, unit } = parameter;
  const withoutUnit =
    unit && name.toLowerCase().endsWith(unit.toLowerCase())
      ? name.slice(0, -unit.length).trimEnd()
      : name;
  return (
    { RecordID: "Record_ID", AGE: "Age", "Blood Group": "Blood_Group" }[withoutUnit] ?? withoutUnit
  );
}).reverse();

function installSheetsApiMock(existingIds: string[] = []) {
  const requests: Array<{ url: URL; method: string; body: string | null }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      requests.push({
        url,
        method,
        body: typeof init?.body === "string" ? init.body : null,
      });
      if (url.pathname.endsWith("/spreadsheets/sheet-1")) {
        return Response.json({ sheets: [{ properties: { title: "Data" } }] });
      }
      if (url.pathname.endsWith("/values/'Data'!A1%3AZZ30")) {
        return Response.json({ values: [headers] });
      }
      if (url.pathname.includes("/values/") && method === "GET") {
        return Response.json({ values: existingIds.map((id) => [id]) });
      }
      if (url.pathname.endsWith(":append") && method === "POST") {
        return Response.json({ updates: { updatedRange: "'Data'!A73:BT73" } });
      }
      return Response.json({ error: "Unexpected test request" }, { status: 500 });
    }),
  );
  return requests;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google Sheets participant append", () => {
  it("warns about an existing RecordID without appending", async () => {
    const requests = installSheetsApiMock(["OTHER", "CASE-1"]);
    const result = await appendReviewedRecord("sheet-1", { RecordID: "case-1" }, "test-token");

    expect(result).toEqual({ duplicate: true, existingRowNumber: 3, sheetName: "Data" });
    expect(requests.some((request) => request.url.pathname.endsWith(":append"))).toBe(false);
  });

  it("only appends a duplicate after an explicit override", async () => {
    const requests = installSheetsApiMock(["CASE-1"]);
    const result = await appendReviewedRecord(
      "sheet-1",
      { RecordID: "case-1" },
      "test-token",
      true,
    );

    expect(result).toEqual({ duplicate: false, rowNumber: 73, sheetName: "Data" });
    expect(requests.some((request) => request.url.pathname.endsWith(":append"))).toBe(true);
  });

  it("writes one header-aligned row and returns the confirmed row number", async () => {
    const requests = installSheetsApiMock();
    const result = await appendReviewedRecord(
      "sheet-1",
      { RecordID: "CASE-2", "Glucose_Fasting mg/dl": "95" },
      "test-token",
    );
    const append = requests.find((request) => request.url.pathname.endsWith(":append"));
    const body = JSON.parse(append?.body ?? "{}") as { values?: string[][] };

    expect(result).toEqual({ duplicate: false, rowNumber: 73, sheetName: "Data" });
    expect(body.values).toHaveLength(1);
    expect(body.values?.[0]?.[headers.indexOf("Record_ID")]).toBe("CASE-2");
    expect(body.values?.[0]?.[headers.indexOf("Glucose_Fasting")]).toBe("95");
    expect(body.values?.[0]).toHaveLength(headers.length);
  });
});
