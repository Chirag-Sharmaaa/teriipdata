// @vitest-environment node

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { readDriveWorkbook } from "@/lib/google-drive-reader.server";

describe("Google Drive workbook reader", () => {
  it.each([
    {
      googleSheet: true,
      expectedPath: "/drive/v3/files/dataset-1/export",
      expectedParameter: "mimeType",
    },
    { googleSheet: false, expectedPath: "/drive/v3/files/dataset-1", expectedParameter: "alt" },
  ])(
    "reads a workbook through the correct read-only endpoint",
    async ({ googleSheet, expectedPath, expectedParameter }) => {
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        ["RecordID", "Name"],
        ["1", "Sample record"],
      ]);
      XLSX.utils.book_append_sheet(workbook, sheet, "Data");
      const workbookBytes = XLSX.write(workbook, {
        type: "array",
        bookType: "xlsx",
      }) as ArrayBuffer;
      const requests: Array<{ url: URL; init: RequestInit | undefined }> = [];
      const fetcher: typeof fetch = async (input, init) => {
        const url = new URL(String(input));
        requests.push({ url, init });
        if (url.searchParams.has("fields")) {
          return Response.json({ modifiedTime: "2026-01-02T03:04:05.000Z" });
        }
        return new Response(workbookBytes);
      };

      const result = await readDriveWorkbook(
        { fileId: "dataset-1", googleSheet },
        "server-only-test-token",
        fetcher,
      );

      expect(result).toEqual({
        modifiedTime: "2026-01-02T03:04:05.000Z",
        rows: [
          ["RecordID", "Name"],
          ["1", "Sample record"],
        ],
      });
      expect(requests).toHaveLength(2);
      expect(requests[0]!.url.searchParams.get("fields")).toBe("modifiedTime");
      expect(requests[1]!.url.pathname).toBe(expectedPath);
      expect(requests[1]!.url.searchParams.has(expectedParameter)).toBe(true);
      expect(requests.every(({ url }) => !url.href.includes("server-only-test-token"))).toBe(true);
      for (const { init } of requests) {
        expect(init?.method ?? "GET").toBe("GET");
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer server-only-test-token",
        );
      }
    },
  );

  it("reads only the configured master-tracker tab", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Wrong tab"], [1]]), "Other");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Institute"], ["AIIMS Delhi"]]),
      "Tracker",
    );
    const workbookBytes = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer;
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.has("fields")) return Response.json({ modifiedTime: null });
      return new Response(workbookBytes);
    };

    await expect(
      readDriveWorkbook(
        { fileId: "master-sheet", googleSheet: true, worksheetName: "Tracker" },
        "server-only-test-token",
        fetcher,
      ),
    ).resolves.toMatchObject({ rows: [["Institute"], ["AIIMS Delhi"]] });

    await expect(
      readDriveWorkbook(
        { fileId: "master-sheet", googleSheet: true, worksheetName: "Missing tab" },
        "server-only-test-token",
        fetcher,
      ),
    ).rejects.toThrow('Google Sheets tab "Missing tab" was not found.');
  });
});
