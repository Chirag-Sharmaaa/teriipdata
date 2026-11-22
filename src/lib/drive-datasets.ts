import type { TERIIP_CENTRES } from "@/lib/teriip-schema";

/** Individually shared Google Sheets used as centre dataset destinations. */
export const CENTRE_DATASETS: Record<
  (typeof TERIIP_CENTRES)[number],
  { fileId: string; fileName: string; googleSheet: boolean; worksheetName?: string }
> = {
  "AIIMS Bhopal": {
    fileId: "1bt_Cip5gHWVJQW9D1LYnIqwlsAcReO1GxpoFKvvaw6g",
    fileName: "AIIMS_Bhopal_Dataset",
    googleSheet: true,
  },
  Bhatinda: {
    fileId: "1sbDv-1_HJlPpnrxFJ_2tvu4vKnJXZsz-VcHaMsJbyHQ",
    fileName: "AIIMS_Bhatinda_Dataset",
    googleSheet: true,
  },
  Delhi: {
    fileId: "1ZKGw6t1ZfHzer3YoSOxhJJ9COPjSdXmkMVS3tvZvsRg",
    fileName: "AIIMS_Delhi_Dataset",
    googleSheet: true,
  },
  Guwahati: {
    fileId: "1kfuOPWsht4X-QkFxNsnpgb-tRBvPeN_-pu6VE9AH6vs",
    fileName: "AIIMS_Guwahati_Dataset",
    googleSheet: true,
  },
  Jodhpur: {
    fileId: "1dP_rCLe1-jvknPmIWWY2vWoa08Tq-uIcPDK-FULIURo",
    fileName: "AIIMS_Jodhpur_Dataset",
    googleSheet: true,
  },
  Raipur: {
    fileId: "1o2AKIihk7mgv0fDZVfkfTfrFVE9v2O-tH68Noq2WOoM",
    fileName: "AIIMS_Raipur_Dataset",
    googleSheet: true,
  },
  Kalyani: {
    fileId: "1B1U_uKJN6G2WXvSt6Z6MwocMF8cdbWjN_R-k7zG0KFc",
    fileName: "AIIMS_Kalyani_Dataset",
    googleSheet: true,
  },
  "Amrita Kochi": {
    fileId: "1Yvfmdck7fW4UcdyaMpBP0WTzPtQFy07XVCN4wYw0Yvs",
    fileName: "Amrita_Kochi_Dataset",
    googleSheet: true,
  },
  "BCCI Guwahati": {
    fileId: "1JB4j_WSMRXHrpCPrBuoxiaqz1keBk40EN0hrXkT82Q8",
    fileName: "BCCI_Guwahati_Dataset",
    googleSheet: true,
  },
  "NIRRH Port Blair": {
    fileId: "1I7l_fO_7WpNbi7xdBWmz2ysSxoRUggEEkWz9vOKe_n8",
    fileName: "ICMR_NIRRH_Dataset",
    googleSheet: true,
  },
  "JSS Mysore": {
    fileId: "1LwJn3nGyMs1wJif5Sk2YGRORBBVMGC3uMu-Z7j8QM-8",
    fileName: "JSS_Dataset",
    googleSheet: true,
  },
  "KGMU Lucknow": {
    fileId: "1JkkqRdzVDF52U_AeiBICvyOANPDQ7Y45vC7ybMiLw2Y",
    fileName: "KGMU_Lucknow_Dataset",
    googleSheet: true,
  },
  "KIMS Bhubaneswar": {
    fileId: "1ti_DVkIs_Uikbg4BrnhBBhm2UvKbZdt7EBX8PPxXAYs",
    fileName: "KIMS_Bhubaneswar_Dataset",
    googleSheet: true,
  },
  "KMC Manipal": {
    fileId: "1csaFnYswBOAXMjYpUSUVzGRK80Tvyf_bCkxY0gEkYyc",
    fileName: "KMC_Manipal_Dataset",
    googleSheet: true,
  },
  "P D Hinduja": {
    fileId: "1-ZyuaANKpNjwV39iFPP-MQdrmkGpy7gjbHta-TXYbws",
    fileName: "PD_Hidnuja_Dataset",
    googleSheet: true,
  },
  "PGIMER Chandigarh": {
    fileId: "1KKEuehVGFn9M8j4QISOaDJ1m3X_IXYHuHvar7KB6nfg",
    fileName: "PGIMER_Dataset",
    googleSheet: true,
  },
};

export type CentreDatasetKey = keyof typeof CENTRE_DATASETS;

export type CentreStats = {
  centre: string;
  fileName: string;
  records: number | null;
  completeness: number | null;
  modifiedTime: string | null;
  error: string | null;
};

/** Counts data rows (non-empty rows after the header) and filled-cell share. Values never leave this function. */
export function summariseRows(rows: unknown[][]): { records: number; completeness: number | null } {
  const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
  const headerIndex = rows.findIndex((r) => r.some(filled));
  if (headerIndex < 0) return { records: 0, completeness: null };
  const width = rows[headerIndex]!.length;
  const data = rows.slice(headerIndex + 1).filter((r) => r.some(filled));
  if (data.length === 0 || width === 0) return { records: 0, completeness: null };
  let count = 0;
  for (const r of data) for (let i = 0; i < width; i++) if (filled(r[i])) count++;
  return { records: data.length, completeness: Math.round((count / (data.length * width)) * 100) };
}
