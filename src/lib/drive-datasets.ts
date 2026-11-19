import type { TERIIP_CENTRES } from "@/lib/teriip-schema";

/** Verified destination dataset for each centre inside "Sample Reports TERIIP PHASE - I". */
export const CENTRE_DATASETS: Record<
  (typeof TERIIP_CENTRES)[number],
  { fileId: string; fileName: string; googleSheet: boolean }
> = {
  "AIIMS Bhopal": { fileId: "169ccqpE-TVdGK__papPJ-PyWkpFPPqx_", fileName: "AIIMS_Bhopal_Dataset.xlsx", googleSheet: false },
  Bhatinda: { fileId: "1sbDv-1_HJlPpnrxFJ_2tvu4vKnJXZsz-VcHaMsJbyHQ", fileName: "AIIMS_Bhatinda_Dataset", googleSheet: true },
  Delhi: { fileId: "1qBdUf-ayDuVXJqOJnwHicQmtTG_7AX-9", fileName: "AIIMS_Delhi_Dataset.xlsx", googleSheet: false },
  Guwahati: { fileId: "1kfuOPWsht4X-QkFxNsnpgb-tRBvPeN_-pu6VE9AH6vs", fileName: "AIIMS_Guwahati_Dataset", googleSheet: true },
  Jodhpur: { fileId: "1GDgo_6havDLz23F598t3N7uRclwva0SB", fileName: "AIIMS_Jodhpur_Dataset.xlsx", googleSheet: false },
  Raipur: { fileId: "1rUwbjY9iquEGaEcHJKA5THgZ9Ipe_YM2", fileName: "AIIMS_Raipur_Dataset.xlsx", googleSheet: false },
  Kalyani: { fileId: "17Rp4Ynj1vqAt60IhrVWGuwqt4f2TPYwM", fileName: "AIIMS_Kalyani_Dataset.xlsx", googleSheet: false },
  "Amrita Kochi": { fileId: "1PeVyWUAYWN-mVqQb5Ba_Umjh8OJLXvkq", fileName: "Copy of ICMR Lab Results.xlsx", googleSheet: false },
  "BCCI Guwahati": { fileId: "1sgiTKloh6o13j_LWuHETnEyKH2pV_xan", fileName: "BCCI_Guwahati_Dataset.xlsx", googleSheet: false },
  "NIRRH Port Blair": { fileId: "1VGR02MsjN_xfiO0FT1-LoS-J_kv4iND-", fileName: "ICMR_NIRRH_Dataset.xlsx", googleSheet: false },
  "JSS Mysore": { fileId: "1w3L7daIgIybS2jlEAxfEOIMNPi-CL04d", fileName: "JSS_Dataset.xlsx", googleSheet: false },
  "KGMU Lucknow": { fileId: "1JaG5EorW7UXetZRNlNq4o4qKf6jJrP5O", fileName: "KGMU_Lucknow_Dataset.xlsx", googleSheet: false },
  "KIMS Bhubaneswar": { fileId: "1sp-RhuOOWlq3mOxBac27GN7ohUycHRNl", fileName: "KIMS_Bhubaneswar_Dataset.xlsx", googleSheet: false },
  "KMC Manipal": { fileId: "15o5eBhk7cgWnOc16_ovwpcIwomSv4et-", fileName: "KMC_Manipal_Dataset.xlsx", googleSheet: false },
  "P D Hinduja": { fileId: "1t4DuH4j0yUZpR87Uw03ZyUkUrcbenLry", fileName: "PD_Hinduja_Dataset.xlsx", googleSheet: false },
  "PGIMER Chandigarh": { fileId: "1KKEuehVGFn9M8j4QISOaDJ1m3X_IXYHuHvar7KB6nfg", fileName: "PGIMER_Dataset", googleSheet: true },
};

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
