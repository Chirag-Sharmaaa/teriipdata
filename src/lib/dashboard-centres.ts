import type { CentreDatasetKey } from "@/lib/drive-datasets";

export type DashboardCentreProfile = {
  canonicalName: string;
  aliases: string[];
  datasetKey: CentreDatasetKey;
  region: string;
  tier: string;
  target: number;
  latitude: number;
  longitude: number;
};

export const DASHBOARD_CENTRES: DashboardCentreProfile[] = [
  {
    canonicalName: "AIIMS Jodhpur",
    aliases: ["AIIMS Jodhpur", "Jodhpur", "All India Institute of Medical Sciences Jodhpur"],
    datasetKey: "Jodhpur",
    region: "West",
    tier: "Tier 2",
    target: 400,
    latitude: 26.2389,
    longitude: 73.0243,
  },
  {
    canonicalName: "AIIMS Bathinda",
    aliases: [
      "AIIMS Bathinda",
      "AIIMS Bhatinda",
      "All India Instituxte of Medical Sciences Bathinda",
      "Bathinda",
      "Bhatinda",
    ],
    datasetKey: "Bhatinda",
    region: "North",
    tier: "Tier 3",
    target: 400,
    latitude: 30.211,
    longitude: 74.9455,
  },
  {
    canonicalName: "AIIMS Bhopal",
    aliases: ["AIIMS Bhopal", "All India Institute of Medical Sciences Bhopal", "Bhopal"],
    datasetKey: "AIIMS Bhopal",
    region: "Central",
    tier: "Tier 2",
    target: 300,
    latitude: 23.2599,
    longitude: 77.4126,
  },
  {
    canonicalName: "AIIMS Raipur",
    aliases: ["AIIMS Raipur", "All India Institute of Medical Sciences Raipur", "Raipur"],
    datasetKey: "Raipur",
    region: "Central",
    tier: "Tier 2",
    target: 600,
    latitude: 21.2514,
    longitude: 81.6296,
  },
  {
    canonicalName: "Amrita Hospital Kochi",
    aliases: ["Amrita Hospital Kochi", "Amrita Kochi", "Amrita Hospital"],
    datasetKey: "Amrita Kochi",
    region: "South",
    tier: "Tier 2",
    target: 200,
    latitude: 9.9312,
    longitude: 76.2673,
  },
  {
    canonicalName: "NIRRH Port Blair",
    aliases: [
      "NIRRH Port Blair",
      "ICMR National Institute for Research in Reproductive Health",
      "NIRRH",
      "Port Blair",
    ],
    datasetKey: "NIRRH Port Blair",
    region: "Others",
    tier: "Tier 3",
    target: 300,
    latitude: 11.6234,
    longitude: 92.7265,
  },
  {
    canonicalName: "JSS Hospital Mysuru",
    aliases: [
      "JSS Hospital Mysuru",
      "JSS Mysuru",
      "JSS Mysore",
      "JSS Medical College",
      "Mysore",
      "Mysuru",
    ],
    datasetKey: "JSS Mysore",
    region: "South",
    tier: "Tier 2",
    target: 300,
    latitude: 12.2958,
    longitude: 76.6394,
  },
  {
    canonicalName: "KIMS Bhubaneswar",
    aliases: [
      "KIMS Bhubaneswar",
      "KIMS Bhubaneshwar",
      "Kalinga Institute of Medical Sciences",
      "Bhubaneswar",
      "Bhubaneshwar",
    ],
    datasetKey: "KIMS Bhubaneswar",
    region: "East",
    tier: "Tier 2",
    target: 200,
    latitude: 20.2961,
    longitude: 85.8245,
  },
  {
    canonicalName: "KMC Manipal",
    aliases: ["KMC Manipal", "Kasturba Medical College", "Manipal"],
    datasetKey: "KMC Manipal",
    region: "South",
    tier: "Tier 3",
    target: 600,
    latitude: 13.3525,
    longitude: 74.7928,
  },
  {
    canonicalName: "P D Hinduja Hospital Mumbai",
    aliases: [
      "P D Hinduja Hospital Mumbai",
      "PD Hinduja Hospital",
      "P.D. Hinduja",
      "Hinduja Hospital Mumbai",
      "P D Hinduja",
      "P.D. Hinduja Hospital & Medical Research Centre",
    ],
    datasetKey: "P D Hinduja",
    region: "West",
    tier: "Tier 1",
    target: 400,
    latitude: 19.0269,
    longitude: 72.8391,
  },
  {
    canonicalName: "AIIMS Delhi",
    aliases: ["AIIMS Delhi", "All India Institute of Medical Sciences Delhi", "Delhi"],
    datasetKey: "Delhi",
    region: "North",
    tier: "Tier 1",
    target: 400,
    latitude: 28.5672,
    longitude: 77.21,
  },
  {
    canonicalName: "AIIMS Kalyani",
    aliases: ["AIIMS Kalyani", "All India Institute of Medical Sciences Kalyani", "Kalyani"],
    datasetKey: "Kalyani",
    region: "East",
    tier: "Tier 3",
    target: 500,
    latitude: 22.975,
    longitude: 88.4345,
  },
  {
    canonicalName: "AIIMS Guwahati",
    aliases: [
      "AIIMS Guwahati",
      "All India Institute of Medical Sciences Guwahati",
      "Guwahati",
      "AIIMS, Guwahati",
    ],
    datasetKey: "Guwahati",
    region: "North-East",
    tier: "Tier 2",
    target: 300,
    latitude: 26.1397,
    longitude: 91.7898,
  },
  {
    canonicalName: "Dr BBCI Guwahati",
    aliases: [
      "Dr BBCI Guwahati",
      "BBCI Guwahati",
      "Dr B Borooah Cancer Institute Guwahati",
      "Dr. B. Borooah Cancer Institute Regional Cancer Centre",
      "B Borooah Cancer Institute",
    ],
    datasetKey: "BCCI Guwahati",
    region: "North-East",
    tier: "Tier 2",
    target: 600,
    latitude: 26.1586,
    longitude: 91.7779,
  },
  {
    canonicalName: "KGMU Lucknow",
    aliases: ["KGMU Lucknow", "King George Medical University", "Lucknow"],
    datasetKey: "KGMU Lucknow",
    region: "North",
    tier: "Tier 2",
    target: 625,
    latitude: 26.8467,
    longitude: 80.9462,
  },
  {
    canonicalName: "PGIMER Chandigarh",
    aliases: [
      "PGIMER Chandigarh",
      "Postgraduate Institute of Medical Education & Research",
      "Chandigarh",
      "PGI Chandigarh",
    ],
    datasetKey: "PGIMER Chandigarh",
    region: "North",
    tier: "Tier 2",
    target: 600,
    latitude: 30.7649,
    longitude: 76.7757,
  },
];

export function normalizeCentreName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function resolveDashboardCentre(value: unknown) {
  const normalized = normalizeCentreName(value);
  if (!normalized) return undefined;
  return DASHBOARD_CENTRES.find((centre) =>
    [centre.canonicalName, ...centre.aliases].some(
      (alias) => normalizeCentreName(alias) === normalized,
    ),
  );
}
