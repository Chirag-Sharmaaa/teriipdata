const DRIVE_API = "https://www.googleapis.com/drive/v3";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function readDriveWorkbook(
  file: { fileId: string; googleSheet: boolean; worksheetName?: string },
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const fileUrl = `${DRIVE_API}/files/${encodeURIComponent(file.fileId)}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const metadataUrl = new URL(fileUrl);
  metadataUrl.searchParams.set("fields", "modifiedTime");
  const metadataResponse = await fetcher(metadataUrl, { headers });
  if (!metadataResponse.ok) {
    throw new Error(`Google Drive metadata request failed (${metadataResponse.status}).`);
  }
  const { modifiedTime } = (await metadataResponse.json()) as { modifiedTime?: string };

  const contentUrl = new URL(file.googleSheet ? `${fileUrl}/export` : fileUrl);
  if (file.googleSheet) {
    contentUrl.searchParams.set("mimeType", XLSX_MIME);
  } else {
    contentUrl.searchParams.set("alt", "media");
  }
  const contentResponse = await fetcher(contentUrl, { headers });
  if (!contentResponse.ok) {
    throw new Error(`Google Drive file request failed (${contentResponse.status}).`);
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(await contentResponse.arrayBuffer()), {
    type: "array",
  });
  if (file.worksheetName && !workbook.Sheets[file.worksheetName]) {
    throw new Error(`Google Sheets tab "${file.worksheetName}" was not found.`);
  }
  const sheetName = file.worksheetName ?? workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const rows = sheet
    ? (XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][])
    : [];
  return { modifiedTime: modifiedTime ?? null, rows };
}
