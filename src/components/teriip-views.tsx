import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpDown,
  CircleCheck,
  CircleX,
  CircleHelp,
  ClipboardCheck,
  Database,
  FileText,
  Filter,
  Info,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle, TeriipShell, useDriveConnection } from "@/components/teriip-shell";
import { COMMON_PARAMETERS, CENTRE_EXTENSIONS, TERIIP_CENTRES } from "@/lib/teriip-schema";
import { useWorkspaceSettings } from "@/lib/teriip-workspace-settings";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import {
  appendReviewedParticipantRecord,
  createParticipantExtractionToken,
  getPdfWorkflowStatus,
} from "@/lib/pdf-review.functions";
import {
  mapExtractorRow,
  normalizeRecordId,
  recordIdFilenameWarning,
  type ExtractedFieldMapping,
} from "@/lib/pdf-review-mapping";
import {
  createEmptyCentreStats,
  type CentreDashboardStats,
  type CountItem,
} from "@/lib/dashboard-aggregates";
import { DASHBOARD_CENTRES, resolveDashboardCentre } from "@/lib/dashboard-centres";
import type { DashboardStatsResult } from "@/lib/drive-stats.functions";

type ActivityRow = {
  id: string;
  type: string;
  centre: string;
  time: string;
  status: string;
  validation: string;
};

function ActivityTable({
  rows = [],
  selectedCentre,
}: {
  rows?: ActivityRow[];
  selectedCentre?: string | undefined;
}) {
  const visibleRows = selectedCentre ? rows.filter((row) => row.centre === selectedCentre) : rows;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>RECORD</th>
            <th>ACTIVITY</th>
            <th>DATE</th>
            <th>STATUS</th>
            <th>VALIDATION</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {visibleRows.slice(0, 10).map((row) => (
            <tr key={row.id}>
              <td>
                <div className="record-id">
                  <span className="record-icon">
                    <FileText size={15} />
                  </span>
                  <strong>{row.id}</strong>
                </div>
              </td>
              <td>
                <span className="type-copy">{row.type}</span>
                {!selectedCentre && <span className="table-subline">{row.centre}</span>}
              </td>
              <td className="date-cell">{row.time}</td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>
                <span
                  className={`validation-text ${row.validation === "Complete" ? "" : "validation-warning"}`}
                >
                  <span />
                  {row.validation}
                </span>
              </td>
              <td>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`More about ${row.id}`}
                  title="More details"
                >
                  <MoreHorizontal size={17} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visibleRows.length === 0 && <div className="empty-state">No activity is available.</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const type =
    status === "Verified" || status === "Submitted" || status === "Ready"
      ? "status-good"
      : status === "Failed"
        ? "status-bad"
        : status === "Duplicate review" || status === "Missing value" || status === "Review"
          ? "status-warn"
          : "status-pending";
  return (
    <Badge variant="outline" className={`status-badge ${type}`}>
      <span />
      {status}
    </Badge>
  );
}

function PageSection({
  icon,
  title,
  detail,
  aside,
  children,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="content-section">
      <SectionTitle icon={icon} title={title} detail={detail} aside={aside} />
      {children}
    </section>
  );
}

const CHART_COLORS = ["#258267", "#527bd3", "#eab05b", "#9a6fd0", "#df7070"];
const INDIA_OUTLINE: Array<[number, number]> = [
  [68.2, 23.8],
  [68.8, 24.9],
  [69.8, 25.3],
  [70.5, 26.6],
  [71.4, 27.1],
  [72.1, 28.1],
  [73.4, 29.5],
  [74.6, 30.8],
  [75.7, 32.1],
  [76.3, 33.3],
  [77.1, 34.8],
  [78.4, 35.5],
  [79.7, 35.9],
  [80.5, 34.7],
  [81.8, 33.9],
  [83.1, 32.9],
  [84.3, 31.7],
  [85.6, 30.5],
  [86.8, 29.1],
  [88.1, 27.7],
  [89.3, 27.0],
  [90.7, 26.9],
  [92.1, 27.1],
  [93.2, 26.6],
  [94.2, 27.3],
  [95.2, 26.8],
  [94.6, 25.6],
  [93.6, 24.7],
  [92.4, 24.1],
  [91.7, 23.1],
  [90.7, 22.6],
  [89.3, 22.2],
  [88.2, 21.8],
  [87.2, 21.6],
  [86.1, 21.7],
  [85.3, 20.8],
  [84.7, 19.8],
  [84.1, 18.7],
  [83.3, 17.7],
  [82.8, 16.4],
  [82.1, 15.6],
  [81.8, 14.5],
  [80.9, 13.6],
  [80.2, 12.6],
  [79.4, 11.6],
  [78.7, 10.7],
  [78.1, 9.7],
  [77.4, 8.6],
  [76.7, 8.0],
  [76.0, 8.5],
  [75.4, 9.7],
  [74.7, 11.0],
  [74.0, 12.5],
  [73.5, 14.2],
  [73.1, 16.0],
  [72.7, 18.2],
  [72.3, 20.0],
  [71.7, 21.4],
  [70.6, 22.4],
  [69.4, 22.9],
];

type DashboardMetric = "screened" | "eligible" | "samplesCollected";
type SortKey =
  | "canonicalName"
  | "region"
  | "nablBiochemistry"
  | "nablHematology"
  | "startDate"
  | "target"
  | "samplesCollected"
  | "completion"
  | "recordsInSheet"
  | "pendingEntry";

function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : Math.round(value).toLocaleString();
}

function formatDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "—";
}

function completionColor(value: number | null) {
  if (value === null) return "#9ba6a2";
  return `hsl(${Math.max(0, Math.min(100, value)) * 1.2} 62% 42%)`;
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  loading,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
  loading: boolean;
  tone?: string;
}) {
  return (
    <article className="dashboard-kpi">
      <div className="dashboard-kpi-heading">
        <span>{label}</span>
        <span className={`dashboard-kpi-icon tone-${tone}`}>
          <Icon size={17} />
        </span>
      </div>
      {loading ? (
        <span className="dashboard-skeleton dashboard-kpi-skeleton" aria-label="Loading" />
      ) : (
        <strong className="dashboard-kpi-value">{value}</strong>
      )}
      <span className="dashboard-kpi-detail">{detail}</span>
    </article>
  );
}

function NablIndicator({ value, label }: { value: boolean | null; label: string }) {
  if (value === null) return <span className="dashboard-unavailable">—</span>;
  return (
    <span
      className={`nabl-indicator ${value ? "is-yes" : "is-no"}`}
      aria-label={`${label}: ${value ? "Yes" : "No"}`}
      title={`${label}: ${value ? "Yes" : "No"}`}
    >
      {value ? <CircleCheck size={16} /> : <CircleX size={16} />}
      <span>{value ? "Yes" : "No"}</span>
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; direction: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      aria-sort={
        current.key === sortKey
          ? current.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        className="dashboard-sort-button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <ArrowUpDown size={12} />
      </button>
    </th>
  );
}

function DashboardWarnings({
  stats,
  centres,
}: {
  stats: DashboardStatsResult | undefined;
  centres: CentreDashboardStats[];
}) {
  if (!stats?.connected) return null;
  const warnings = [
    ...(stats.tracker.error ? [stats.tracker.error] : []),
    ...stats.tracker.warnings,
    ...(stats.tracker.unmatchedRows.length
      ? [`Master tracker rows not matched to a centre: ${stats.tracker.unmatchedRows.join(", ")}`]
      : []),
    ...(stats.tracker.centresWithoutRow.length
      ? [`Centres without a master tracker row: ${stats.tracker.centresWithoutRow.join(", ")}`]
      : []),
    ...(stats.tracker.duplicateRows.length
      ? [`Multiple master tracker rows matched: ${stats.tracker.duplicateRows.join(", ")}`]
      : []),
    ...centres.flatMap((centre) =>
      centre.sheetWarnings.map((warning) => `${centre.canonicalName}: ${warning}`),
    ),
    ...centres
      .filter((centre) => centre.sheetError)
      .map((centre) => `${centre.canonicalName}: ${centre.sheetError}`),
  ];
  if (warnings.length === 0) return null;
  return (
    <div className="dashboard-warning" role="status">
      <Info size={16} />
      <div>
        <strong>Data source warnings</strong>
        <ul>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CentreProgressTable({
  centres,
  loading,
}: {
  centres: CentreDashboardStats[];
  loading: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "canonicalName",
    direction: "asc",
  });
  const sortBy = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };
  const valueFor = (centre: CentreDashboardStats, key: SortKey) => {
    switch (key) {
      case "canonicalName":
        return centre.canonicalName;
      case "region":
        return centre.region;
      case "nablBiochemistry":
        return centre.tracker.nablBiochemistry === null
          ? null
          : Number(centre.tracker.nablBiochemistry);
      case "nablHematology":
        return centre.tracker.nablHematology === null
          ? null
          : Number(centre.tracker.nablHematology);
      case "startDate":
        return centre.tracker.startDate;
      case "target":
        return centre.target;
      case "samplesCollected":
        return centre.tracker.samplesCollected;
      case "completion":
        return centre.completion;
      case "recordsInSheet":
        return centre.recordsInSheet;
      case "pendingEntry":
        return centre.pendingEntry;
    }
  };
  const sortedCentres = [...centres].sort((left, right) => {
    const a = valueFor(left, sort.key);
    const b = valueFor(right, sort.key);
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
    if (b === null || b === undefined) return -1;
    const comparison =
      typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    return sort.direction === "asc" ? comparison : -comparison;
  });
  const headers: Array<{ label: string; key: SortKey }> = [
    { label: "Centre", key: "canonicalName" },
    { label: "Region", key: "region" },
    { label: "NABL biochem", key: "nablBiochemistry" },
    { label: "NABL haem", key: "nablHematology" },
    { label: "Start date", key: "startDate" },
    { label: "Target", key: "target" },
    { label: "Achieved", key: "samplesCollected" },
    { label: "Completion", key: "completion" },
    { label: "Records in sheet", key: "recordsInSheet" },
    { label: "Pending entry", key: "pendingEntry" },
  ];

  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <SortableHeader
                key={header.key}
                label={header.label}
                sortKey={header.key}
                current={sort}
                onSort={sortBy}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <tr key={`loading-${index}`} className="dashboard-loading-row">
                  <td colSpan={10}>
                    <span className="dashboard-skeleton" />
                  </td>
                </tr>
              ))
            : sortedCentres.map((centre) => {
                const percent = centre.completion;
                const completionTone =
                  percent === null
                    ? "unknown"
                    : percent < 40
                      ? "low"
                      : percent < 80
                        ? "medium"
                        : "high";
                return (
                  <tr key={centre.datasetKey}>
                    <td className="dashboard-centre-name">{centre.canonicalName}</td>
                    <td>{centre.region}</td>
                    <td>
                      <NablIndicator
                        value={centre.tracker.nablBiochemistry}
                        label="NABL biochemistry"
                      />
                    </td>
                    <td>
                      <NablIndicator
                        value={centre.tracker.nablHematology}
                        label="NABL hematology"
                      />
                    </td>
                    <td>{formatDate(centre.tracker.startDate)}</td>
                    <td>{formatCount(centre.target)}</td>
                    <td>{formatCount(centre.tracker.samplesCollected)}</td>
                    <td>
                      <div className={`completion-cell completion-${completionTone}`}>
                        <strong>{percent === null ? "—" : `${percent}%`}</strong>
                        <span className="progress-track">
                          <span
                            style={{
                              width: `${Math.min(100, Math.max(0, percent ?? 0))}%`,
                              backgroundColor: completionColor(percent),
                            }}
                          />
                        </span>
                      </div>
                    </td>
                    <td>
                      {centre.sheetError ? (
                        <span className="sheet-error">Sheet error</span>
                      ) : (
                        formatCount(centre.recordsInSheet)
                      )}
                    </td>
                    <td>{formatCount(centre.pendingEntry)}</td>
                  </tr>
                );
              })}
        </tbody>
      </table>
      {!loading && centres.length === 0 && (
        <div className="empty-state">No centre is assigned to this account.</div>
      )}
    </div>
  );
}

function IndiaMap({ centres }: { centres: CentreDashboardStats[] }) {
  const width = 620;
  const height = 480;
  const padding = 28;
  const minLongitude = 67;
  const maxLongitude = 97;
  const minLatitude = 6;
  const maxLatitude = 37;
  const pointFor = (latitude: number, longitude: number) => ({
    x:
      padding +
      ((longitude - minLongitude) / (maxLongitude - minLongitude)) * (width - padding * 2),
    y: padding + ((maxLatitude - latitude) / (maxLatitude - minLatitude)) * (height - padding * 2),
  });
  const outline = INDIA_OUTLINE.map(([longitude, latitude]) => pointFor(latitude, longitude));
  const path =
    outline.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ") +
    " Z";
  const portBlair = pointFor(11.62, 92.73);

  return (
    <div className="india-map-frame">
      <svg
        className="india-map"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Map of India with one marker for each TERIIP centre"
      >
        <path className="india-map-outline" d={path} />
        <path
          className="india-map-state-line"
          d={`M${pointFor(23, 78).x},${pointFor(23, 78).y} L${pointFor(20, 84).x},${pointFor(20, 84).y} L${pointFor(24, 88).x},${pointFor(24, 88).y}`}
        />
        <ellipse
          className="india-map-island"
          cx={portBlair.x}
          cy={portBlair.y + 17}
          rx="4"
          ry="12"
        />
        {centres.map((centre) => {
          const point = pointFor(centre.latitude, centre.longitude);
          const offset = centre.datasetKey === "BCCI Guwahati" ? { x: 8, y: -4 } : { x: 0, y: 0 };
          const achieved = centre.tracker.samplesCollected;
          const radius = achieved === null ? 3.5 : 3.5 + 6 * Math.sqrt(Math.min(1, achieved / 625));
          const label = `${centre.canonicalName}, ${centre.region}, ${centre.tier}. Completion ${
            centre.completion === null ? "not available" : `${centre.completion}%`
          }. Achieved ${formatCount(achieved)} of ${formatCount(centre.target)}.`;
          return (
            <g key={centre.datasetKey} className="india-map-marker" aria-label={label} tabIndex={0}>
              <title>{label}</title>
              <circle
                cx={point.x + offset.x}
                cy={point.y + offset.y}
                r={radius}
                fill={completionColor(centre.completion)}
              />
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <span>Completion</span>
        <span className="map-gradient" aria-hidden="true" />
        <span>0%</span>
        <span>100%</span>
        <span className="map-no-data-dot" />
        <span>No data</span>
        <span className="map-legend-dot" />
        <span>Dot size = achieved samples</span>
      </div>
    </div>
  );
}

function DashboardFunnel({
  values,
  compact = false,
}: {
  values: Array<{ label: string; value: number | null }>;
  compact?: boolean;
}) {
  const orderedValues = [...values].sort((left, right) => {
    if (left.value === null) return right.value === null ? 0 : 1;
    if (right.value === null) return -1;
    return right.value - left.value;
  });
  const knownValues = orderedValues
    .map(({ value }) => value)
    .filter((value): value is number => value !== null);
  const maxValue = Math.max(0, ...knownValues);
  if (knownValues.length === 0) {
    return (
      <div className={`chart-empty${compact ? " is-compact" : ""}`}>No tracker counts loaded.</div>
    );
  }
  return (
    <div className={`dashboard-funnel${compact ? " is-compact" : ""}`}>
      {orderedValues.map(({ label, value }) => (
        <div className="funnel-row" key={label}>
          <div className="funnel-label">
            <span>{label}</span>
            <strong>{formatCount(value)}</strong>
          </div>
          <div className="funnel-track">
            <span
              style={{
                width: `${value === null || maxValue === 0 ? 0 : (value / maxValue) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardBarChart({
  data,
  height = 390,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
}) {
  if (data.length === 0) return <div className="chart-empty">Refresh to load chart data.</div>;
  return (
    <div className="dashboard-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 38, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={172}
            tick={{ fill: "var(--chart-label)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(value) => [formatCount(Number(value)), "Participants"]} />
          <Bar dataKey="value" fill="var(--chart-green)" radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value: unknown) => formatCount(Number(value))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieSummary({ data, emptyText }: { data: CountItem[]; emptyText: string }) {
  const visible = data.filter((item) => item.count > 0);
  const total = visible.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <div className="chart-empty">{emptyText}</div>;
  return (
    <div className="pie-summary">
      <div className="dashboard-chart pie-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="count"
              nameKey="label"
              innerRadius="60%"
              outerRadius="88%"
              paddingAngle={2}
            >
              {visible.map((item, index) => (
                <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatCount(Number(value)), "Records"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="pie-legend">
        {visible.map((item, index) => (
          <li key={item.label}>
            <span style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
            <span>{item.label}</span>
            <strong>{formatCount(item.count)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sumDistribution(centres: CentreDashboardStats[], key: "ageCounts" | "genderCounts") {
  const counts = new Map<string, number>();
  for (const centre of centres) {
    for (const item of centre[key] ?? []) {
      counts.set(item.label, (counts.get(item.label) ?? 0) + item.count);
    }
  }
  return [...counts].map(([label, count]) => ({ label, count }));
}

export function DashboardView() {
  const { activeCentre, setActiveCentre } = useWorkspaceSettings();
  const { account } = useTeriipAuth();
  const [refreshMessage, setRefreshMessage] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<DashboardMetric>("screened");
  const isSuperAdmin = account?.role === "super_admin";
  const ownCentre = resolveDashboardCentre(account?.centreId);
  const selectedProfile = isSuperAdmin
    ? (DASHBOARD_CENTRES.find((profile) => profile.datasetKey === activeCentre) ??
      DASHBOARD_CENTRES[0]!)
    : ownCentre;
  const displayName = account?.displayName || account?.username || "there";
  const statsQuery = useDriveConnection();
  const stats = statsQuery.data;
  const profiles = isSuperAdmin ? DASHBOARD_CENTRES : ownCentre ? [ownCentre] : [];
  const centres = profiles.map(
    (profile) =>
      stats?.centres.find((centre) => centre.datasetKey === profile.datasetKey) ??
      createEmptyCentreStats(profile),
  );
  const selectedCentre =
    centres.find((centre) => centre.datasetKey === selectedProfile?.datasetKey) ?? centres[0];
  const loading = statsQuery.isFetching && !stats?.fetchedAt;
  const allCollectedKnown =
    centres.length > 0 && centres.every((centre) => centre.tracker.samplesCollected !== null);
  const collectedTotal = allCollectedKnown
    ? centres.reduce((sum, centre) => sum + (centre.tracker.samplesCollected ?? 0), 0)
    : null;
  const targetTotal = centres.reduce((sum, centre) => sum + centre.target, 0);
  const completionTotal =
    collectedTotal === null || targetTotal === 0
      ? null
      : Math.round((collectedTotal / targetTotal) * 100);
  const activeCentres = allCollectedKnown
    ? centres.filter((centre) => (centre.tracker.samplesCollected ?? 0) > 0).length
    : null;
  const allPendingKnown =
    centres.length > 0 && centres.every((centre) => centre.pendingEntry !== null);
  const pendingTotal = allPendingKnown
    ? centres.reduce((sum, centre) => sum + (centre.pendingEntry ?? 0), 0)
    : null;
  const screens = (centre: CentreDashboardStats, metric: DashboardMetric) => centre.tracker[metric];
  const funnelValues = [
    {
      label: "Screened",
      value: centres.every((centre) => centre.tracker.screened !== null)
        ? centres.reduce((sum, centre) => sum + (centre.tracker.screened ?? 0), 0)
        : null,
    },
    {
      label: "Eligible",
      value: centres.every((centre) => centre.tracker.eligible !== null)
        ? centres.reduce((sum, centre) => sum + (centre.tracker.eligible ?? 0), 0)
        : null,
    },
    {
      label: "Samples collected",
      value: centres.every((centre) => centre.tracker.samplesCollected !== null)
        ? collectedTotal
        : null,
    },
  ];
  const chartData = centres
    .map((centre) => ({ label: centre.canonicalName, value: screens(centre, selectedMetric) }))
    .filter((item): item is { label: string; value: number } => item.value !== null);
  const ageData = sumDistribution(centres, "ageCounts").map(({ label, count }) => ({
    label,
    value: count,
  }));
  const genderData = sumDistribution(centres, "genderCounts");
  const successfulSheetCount = centres.filter((centre) => centre.recordsInSheet !== null).length;
  const ruralUrbanData =
    stats?.tracker.ruralTotal === null ||
    stats?.tracker.ruralTotal === undefined ||
    stats?.tracker.urbanTotal === null ||
    stats?.tracker.urbanTotal === undefined
      ? []
      : [
          { label: "Rural", count: stats.tracker.ruralTotal },
          { label: "Urban", count: stats.tracker.urbanTotal },
        ];

  const refreshDashboard = async () => {
    setRefreshMessage("Refreshing dashboard data…");
    try {
      const result = await statsQuery.refreshNow();
      if (result.status === "disabled") {
        setRefreshMessage("Dashboard refresh was blocked because real-data reads are disabled.");
      } else if (result.status === "missing_credentials") {
        setRefreshMessage("Dashboard refresh needs Google service-account credentials.");
      } else if (result.tracker.error) {
        setRefreshMessage("Centre sheets refreshed; the master tracker could not be read.");
      } else if (result.centres.some((centre) => centre.sheetError)) {
        setRefreshMessage("Dashboard refreshed with one or more centre sheet errors.");
      } else {
        setRefreshMessage(
          `Dashboard refreshed at ${new Date(result.fetchedAt!).toLocaleTimeString()}.`,
        );
      }
    } catch {
      setRefreshMessage("Dashboard refresh failed. Please try again.");
    }
  };

  return (
    <TeriipShell
      eyebrow={isSuperAdmin ? "HEADQUARTERS WORKSPACE" : "CENTRE WORKSPACE"}
      title={`Welcome, ${displayName}`}
      description="Project progress and centre data from the master tracker and destination sheets."
      actions={
        <div className="dashboard-refresh">
          <span>
            Last updated:{" "}
            {stats?.fetchedAt ? new Date(stats.fetchedAt).toLocaleString() : "Not yet refreshed"}
          </span>
          <Button
            variant="outline"
            className="quiet-action"
            onClick={() => void refreshDashboard()}
            disabled={statsQuery.isFetching}
          >
            <RefreshCw size={15} className={statsQuery.isFetching ? "is-spinning" : ""} />
            Refresh now
          </Button>
        </div>
      }
    >
      {refreshMessage && (
        <p className="dashboard-refresh-message" role="status" aria-live="polite">
          {refreshMessage}
        </p>
      )}

      {isSuperAdmin && (
        <section className="dashboard-section" aria-labelledby="overview-title">
          <div className="dashboard-section-heading">
            <div>
              <p className="small-label">HEADQUARTERS · ALL CENTRES</p>
              <h2 id="overview-title">Project overview</h2>
            </div>
            <span className="dashboard-centre-count">{centres.length} centres</span>
          </div>
          <div className="dashboard-kpi-grid">
            <KpiCard
              label="TOTAL SAMPLES COLLECTED"
              value={formatCount(collectedTotal)}
              detail={allCollectedKnown ? "Master tracker total" : "Waiting for all tracker rows"}
              icon={Database}
              loading={loading}
              tone="teal"
            />
            <KpiCard
              label="TOTAL TARGET"
              value={formatCount(targetTotal)}
              detail="Across 16 configured centres"
              icon={Users}
              loading={false}
              tone="blue"
            />
            <KpiCard
              label="OVERALL COMPLETION"
              value={completionTotal === null ? "—" : `${completionTotal}%`}
              detail="Collected samples ÷ total target"
              icon={MapPin}
              loading={loading}
              tone="orange"
            />
            <KpiCard
              label="CENTRES ACTIVE"
              value={activeCentres === null ? "—" : `${activeCentres} / 16`}
              detail="Centres with samples collected"
              icon={CircleCheck}
              loading={loading}
            />
            <KpiCard
              label="PENDING DATA ENTRY"
              value={formatCount(pendingTotal)}
              detail={
                allPendingKnown ? "Collected minus sheet records" : "Waiting for sheet counts"
              }
              icon={CircleHelp}
              loading={loading}
              tone="orange"
            />
          </div>

          <section className="dashboard-panel" aria-labelledby="centre-progress-title">
            <SectionTitle
              icon={Database}
              title="Centre progress"
              detail="Live tracker values and participant record counts; rows are sortable."
            />
            <CentreProgressTable centres={centres} loading={loading} />
          </section>
          <DashboardWarnings stats={stats} centres={centres} />

          <div className="dashboard-panel dashboard-map-panel">
            <SectionTitle
              icon={MapPin}
              title="Centre map"
              detail="Marker size reflects samples collected; colour reflects target completion."
            />
            <IndiaMap centres={centres} />
          </div>

          <div className="dashboard-two-column">
            <section className="dashboard-panel" aria-labelledby="funnel-title">
              <SectionTitle
                icon={ClipboardCheck}
                title="Participant funnel"
                detail="Counts from the master tracker."
              />
              <DashboardFunnel values={funnelValues} />
              <div className="dashboard-chart-selector">
                <label htmlFor="dashboard-chart-metric">Compare centres by</label>
                <select
                  id="dashboard-chart-metric"
                  className="standard-select"
                  value={selectedMetric}
                  onChange={(event) => setSelectedMetric(event.target.value as DashboardMetric)}
                >
                  <option value="screened">Screened</option>
                  <option value="eligible">Eligible</option>
                  <option value="samplesCollected">Collected</option>
                </select>
              </div>
              <DashboardBarChart data={chartData} />
            </section>

            <section className="dashboard-panel" aria-labelledby="demographics-title">
              <SectionTitle
                icon={Users}
                title="Demographics"
                detail={`Aggregated from ${successfulSheetCount} of ${centres.length} centre sheets.`}
              />
              <h3 className="dashboard-chart-title">Age distribution</h3>
              {ageData.length === 0 ? (
                <div className="chart-empty">Refresh to load age data.</div>
              ) : (
                <DashboardBarChart data={ageData} height={250} />
              )}
              <div className="dashboard-pie-grid">
                <div>
                  <h3 className="dashboard-chart-title">Gender</h3>
                  <PieSummary data={genderData} emptyText="No gender data available." />
                </div>
                <div>
                  <h3 className="dashboard-chart-title">Rural vs urban samples</h3>
                  <PieSummary
                    data={ruralUrbanData}
                    emptyText="Rural/urban tracker columns unavailable."
                  />
                </div>
              </div>
            </section>
          </div>
        </section>
      )}

      <section
        className="dashboard-section centre-dashboard-section"
        aria-labelledby="centre-dashboard-title"
      >
        <div className="dashboard-section-heading">
          <div>
            <p className="small-label">{isSuperAdmin ? "CENTRE DETAIL" : "YOUR CENTRE"}</p>
            <h2 id="centre-dashboard-title">
              {selectedProfile?.canonicalName ?? "Centre dashboard"}
            </h2>
          </div>
          {isSuperAdmin && (
            <label className="dashboard-centre-select">
              <span>Centre</span>
              <select
                className="standard-select"
                value={selectedProfile?.datasetKey ?? ""}
                onChange={(event) => setActiveCentre(event.target.value)}
                aria-label="Select centre dashboard"
              >
                {DASHBOARD_CENTRES.map((centre) => (
                  <option key={centre.datasetKey} value={centre.datasetKey}>
                    {centre.canonicalName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {selectedCentre ? (
          <>
            <div className="dashboard-kpi-grid centre-kpi-grid">
              <KpiCard
                label="SAMPLES VS TARGET"
                value={`${formatCount(selectedCentre.tracker.samplesCollected)} / ${formatCount(selectedCentre.target)}`}
                detail={
                  selectedCentre.completion === null
                    ? "Waiting for a tracker row"
                    : `${selectedCentre.completion}% of target`
                }
                icon={Database}
                loading={loading}
                tone="teal"
              />
              <KpiCard
                label="RECORDS IN SHEET"
                value={
                  selectedCentre.sheetError
                    ? "Sheet error"
                    : formatCount(selectedCentre.recordsInSheet)
                }
                detail="Non-empty participant ID rows"
                icon={Users}
                loading={loading}
                tone="blue"
              />
              <KpiCard
                label="PENDING DATA ENTRY"
                value={formatCount(selectedCentre.pendingEntry)}
                detail="Samples collected minus sheet records"
                icon={ClipboardCheck}
                loading={loading}
                tone="orange"
              />
            </div>
            <div className="centre-progress-detail">
              <div className="centre-progress-copy">
                <strong>Target completion</strong>
                <span>
                  {selectedCentre.completion === null
                    ? "No tracker value available"
                    : `${selectedCentre.completion}%`}
                </span>
              </div>
              <span className="progress-track centre-progress-track">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, selectedCentre.completion ?? 0))}%`,
                    backgroundColor: completionColor(selectedCentre.completion),
                  }}
                />
              </span>
            </div>
            <section className="dashboard-panel centre-funnel-panel">
              <SectionTitle
                icon={ClipboardCheck}
                title="Centre funnel"
                detail="Screened, eligible, and samples collected."
              />
              <DashboardFunnel
                compact
                values={[
                  { label: "Screened", value: selectedCentre.tracker.screened },
                  { label: "Eligible", value: selectedCentre.tracker.eligible },
                  { label: "Samples collected", value: selectedCentre.tracker.samplesCollected },
                ]}
              />
            </section>
            {!isSuperAdmin && <DashboardWarnings stats={stats} centres={centres} />}
          </>
        ) : (
          <div className="empty-state">No centre is assigned to this account.</div>
        )}
      </section>
      {isSuperAdmin && (
        <div className="bottom-note">
          <ShieldCheck size={15} />
          <span>
            Participant rows are processed in memory on the server. Only centre-level counts and
            demographic aggregates are returned; participant-level data is never saved here.
          </span>
        </div>
      )}
    </TeriipShell>
  );
}

const MAX_PARTICIPANT_UPLOAD_BYTES = 15 * 1024 * 1024;
const EXTRACTION_UNAVAILABLE_MESSAGE =
  "Automatic extraction is unavailable - please enter values manually";

function extractionServiceEndpoint() {
  const configured = import.meta.env["VITE_TERIIP_EXTRACTION_SERVICE_URL"];
  if (!configured) throw new TypeError("Extraction service URL is missing.");

  const url = new URL(configured);
  const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !isLocalHttp) || url.username || url.password) {
    throw new TypeError("Extraction service URL must use HTTPS.");
  }
  url.pathname = "/extract";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function UploadView() {
  const { activeCentre, enabledExtensions, reviewCentre, setReviewCentre } = useWorkspaceSettings();
  const { account } = useTeriipAuth();
  const [query, setQuery] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [diagnostics, setDiagnostics] = useState<ExtractedFieldMapping | null>(null);
  const [extractionSupported, setExtractionSupported] = useState(false);
  const [ocrUsed, setOcrUsed] = useState(false);
  const [workflowEnabled, setWorkflowEnabled] = useState(false);
  const [checkingWorkflow, setCheckingWorkflow] = useState(true);
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savedRowNumber, setSavedRowNumber] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordIdInputRef = useRef<HTMLInputElement>(null);
  const saveResultRef = useRef<HTMLParagraphElement>(null);
  const [saveFeedback, setSaveFeedback] = useState<{
    kind: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [duplicateExistingRow, setDuplicateExistingRow] = useState<number | null>(null);
  const extensionsForCentre = enabledExtensions[activeCentre] ?? false;
  const parameters = useMemo(
    () => (extensionsForCentre ? [...COMMON_PARAMETERS, ...CENTRE_EXTENSIONS] : COMMON_PARAMETERS),
    [extensionsForCentre],
  );
  const isSuperAdmin = account?.role === "super_admin";
  const assignedCentre = resolveDashboardCentre(account?.centreId);
  const centreName = isSuperAdmin ? reviewCentre : (assignedCentre?.canonicalName ?? "");
  const isHinduja = centreName === "P D Hinduja Hospital Mumbai";
  const extractorAvailable = Boolean(
    centreName &&
    !["AIIMS Guwahati", "Amrita Hospital Kochi", "PGIMER Chandigarh"].includes(centreName),
  );
  const emptyValues = () => Object.fromEntries(parameters.map((parameter) => [parameter.name, ""]));
  const filledCount = parameters.filter((parameter) => fieldValues[parameter.name]?.trim()).length;
  const shown = parameters.filter((parameter) =>
    `${parameter.name} ${parameter.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const resetReview = () => {
    setQuery("");
    setSelectedFileName(null);
    setUploadMessage(null);
    setFieldValues(emptyValues());
    setDiagnostics(null);
    setExtractionSupported(false);
    setOcrUsed(false);
    setConfirming(false);
    setSavedRowNumber(null);
    setSaveFeedback(null);
    setDuplicateExistingRow(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    setQuery("");
    setSelectedFileName(null);
    setUploadMessage(null);
    setFieldValues(Object.fromEntries(parameters.map((parameter) => [parameter.name, ""])));
    setDiagnostics(null);
    setExtractionSupported(false);
    setOcrUsed(false);
    setConfirming(false);
    setSavedRowNumber(null);
    setSaveFeedback(null);
    setDuplicateExistingRow(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [centreName, parameters]);

  useEffect(() => {
    if (saveFeedback) {
      saveResultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }, [saveFeedback]);

  useEffect(() => {
    let active = true;
    void getPdfWorkflowStatus({ data: {} })
      .then((status) => {
        if (!active) return;
        setWorkflowEnabled(status.enabled);
        setWorkflowMessage(status.message);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setWorkflowEnabled(false);
        setWorkflowMessage(
          error instanceof Error ? error.message : "The workflow status could not be checked.",
        );
      })
      .finally(() => {
        if (active) setCheckingWorkflow(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const readSelectedFile = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !centreName || !workflowEnabled) return;
    const extension = isHinduja ? ".csv" : ".pdf";
    if (!file.name.toLowerCase().endsWith(extension)) {
      setUploadMessage(`Choose a ${isHinduja ? "CSV" : "PDF"} file for this centre.`);
      return;
    }
    if (file.size > MAX_PARTICIPANT_UPLOAD_BYTES) {
      setUploadMessage("The selected file must be 15 MB or smaller.");
      return;
    }

    setIsReading(true);
    setUploadMessage(null);
    setDiagnostics(null);
    setFieldValues(emptyValues());
    setSavedRowNumber(null);
    setSaveFeedback(null);
    setDuplicateExistingRow(null);
    setSelectedFileName(file.name);
    try {
      const { token } = await createParticipantExtractionToken({
        data: { centreName },
      });
      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await fetch(extractionServiceEndpoint(), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        if (response.status === 413) {
          setUploadMessage("The selected file must be 15 MB or smaller.");
        } else if (response.status === 401) {
          setUploadMessage(EXTRACTION_UNAVAILABLE_MESSAGE);
        } else {
          setUploadMessage("The report could not be processed. Please enter values manually.");
        }
        return;
      }
      const result = (await response.json()) as {
        status?: unknown;
        row?: unknown;
        ocrUsed?: unknown;
      };
      if (
        result.status !== "ok" ||
        !result.row ||
        typeof result.row !== "object" ||
        Array.isArray(result.row)
      ) {
        setUploadMessage("The report could not be processed. Please enter values manually.");
        return;
      }
      const mapping = mapExtractorRow(
        result.row as Record<string, unknown>,
        result.ocrUsed === true,
        parameters,
      );
      setFieldValues({ ...emptyValues(), ...mapping.values });
      setDiagnostics(mapping);
      setExtractionSupported(true);
      setOcrUsed(result.ocrUsed === true);
    } catch (error) {
      setFieldValues(emptyValues());
      setDiagnostics(null);
      setExtractionSupported(false);
      setOcrUsed(false);
      setUploadMessage(
        error instanceof TypeError || (error instanceof Error && error.name === "TimeoutError")
          ? EXTRACTION_UNAVAILABLE_MESSAGE
          : error instanceof Error
            ? error.message
            : "The report could not be processed. Please enter values manually.",
      );
    } finally {
      setIsReading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startReviewConfirmation = () => {
    const recordId = fieldValues["RecordID"] ?? "";
    const warning = recordIdFilenameWarning(recordId, selectedFileName);
    setDuplicateExistingRow(null);
    if (!recordId.trim()) {
      setConfirming(false);
      setSaveFeedback({ kind: "error", message: warning! });
      recordIdInputRef.current?.focus();
      return;
    }
    setSaveFeedback(warning ? { kind: "warning", message: warning } : null);
    setConfirming(true);
  };

  const saveReviewedRow = async (allowDuplicate = false) => {
    if (!centreName || !workflowEnabled) return;
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const result = await appendReviewedParticipantRecord({
        data: { centreName, values: fieldValues, allowDuplicate },
      });
      if (result.status === "duplicate") {
        setDuplicateExistingRow(result.existingRowNumber);
        setConfirming(true);
        setSaveFeedback({
          kind: "warning",
          message: `Record ID "${fieldValues["RecordID"]?.trim()}" already exists in the "${result.sheetName}" tab at row ${result.existingRowNumber}. Nothing has been written. Confirm "Add anyway" only if this duplicate is intentional.`,
        });
        return;
      }
      setSavedRowNumber(result.rowNumber);
      setConfirming(false);
      setDuplicateExistingRow(null);
      setSaveFeedback({
        kind: "success",
        message: `Row ${result.rowNumber} was added to the "${result.sheetName}" tab in ${centreName}'s Google Sheet.`,
      });
    } catch (error) {
      setSaveFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "The row could not be added.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TeriipShell
      eyebrow="RECORD WORKFLOW"
      title="PDF report review"
      description="Check and correct extracted values before adding one row to the selected centre's Google Sheet."
      actions={
        <Button
          variant="outline"
          className="quiet-action"
          disabled={isReading || isSaving}
          onClick={resetReview}
        >
          Reset review
        </Button>
      }
    >
      <div className="workflow-safety">
        <LockKeyhole size={16} />
        <div>
          <strong>Handle participant reports carefully.</strong>
          <span> Files and extracted values stay in memory and are not saved by this app.</span>
        </div>
      </div>
      {!workflowEnabled && (
        <p className="pdf-upload-message" role="status" aria-live="polite">
          {checkingWorkflow ? "Checking workflow readiness..." : workflowMessage}
        </p>
      )}
      {isSuperAdmin ? (
        <div className="pdf-file-control centre-select-control">
          <label htmlFor="review-centre">Centre for this report</label>
          <select
            id="review-centre"
            className="standard-select"
            value={reviewCentre}
            disabled={isReading || isSaving || confirming}
            onChange={(event) => setReviewCentre(event.target.value)}
          >
            <option value="">Choose a centre</option>
            {DASHBOARD_CENTRES.map((centre) => (
              <option key={centre.canonicalName} value={centre.canonicalName}>
                {centre.canonicalName}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="review-centre-lock">
          {centreName ? `Assigned centre: ${centreName}` : "No centre is assigned to this account."}
        </p>
      )}
      <div className="pdf-upload-controls">
        <div className="pdf-file-control">
          <label htmlFor="report-pdf">Participant report ({isHinduja ? "CSV" : "PDF"})</label>
          <Input
            ref={fileInputRef}
            id="report-pdf"
            type="file"
            accept={isHinduja ? "text/csv,.csv" : "application/pdf,.pdf"}
            disabled={
              !centreName ||
              !workflowEnabled ||
              checkingWorkflow ||
              !extractorAvailable ||
              isReading ||
              isSaving
            }
            aria-label={`Choose a participant ${isHinduja ? "CSV" : "PDF"} report`}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              const isExpectedFile = Boolean(
                file && file.name.toLowerCase().endsWith(isHinduja ? ".csv" : ".pdf"),
              );
              setSelectedFileName(isExpectedFile && file ? file.name : null);
              setUploadMessage(
                file && !isExpectedFile
                  ? `Please select a ${isHinduja ? "CSV" : "PDF"} file.`
                  : null,
              );
            }}
          />
        </div>
        {extractorAvailable && (
          <Button
            className="primary-action"
            disabled={
              !selectedFileName ||
              !centreName ||
              !workflowEnabled ||
              checkingWorkflow ||
              isReading ||
              isSaving
            }
            onClick={() => void readSelectedFile()}
          >
            <FileText size={16} />{" "}
            {isReading ? (isHinduja ? "Reading CSV..." : "Reading PDF...") : "Upload and read"}
          </Button>
        )}
      </div>
      {!extractorAvailable && centreName && (
        <p className="review-hint" role="status">
          No extractor is available for this centre yet. All fields below are ready for manual
          entry.
        </p>
      )}
      {centreName && <p className="review-centre-lock">Destination: {centreName}'s Google Sheet</p>}
      {uploadMessage && (
        <p className="pdf-upload-message" role="status" aria-live="polite">
          {uploadMessage}
        </p>
      )}
      <div className="review-summary-strip">
        <div className="file-symbol">
          <FileText size={20} />
        </div>
        <div className="summary-file">
          <strong>{selectedFileName ?? "No report selected"}</strong>
          <span>
            {centreName ? `Review for ${centreName}` : "Choose the destination centre first"}
          </span>
        </div>
        <Badge
          variant="outline"
          className={`status-badge ${selectedFileName ? "status-good" : "status-pending"}`}
        >
          <span /> {isReading ? "Reading" : selectedFileName ? "Ready to review" : "Waiting"}
        </Badge>
        <div className="summary-progress">
          <span>
            {filledCount} of {parameters.length} fields populated
          </span>
          <div className="mini-progress">
            <span
              style={{
                width: `${parameters.length ? (filledCount / parameters.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>
      <div className="extension-note">
        {parameters.length} editable fields are shown. Extractor-only values are listed separately
        below.
      </div>
      {ocrUsed && (
        <p className="pdf-upload-message" role="status">
          OCR was used on this report. Populated fields are highlighted for careful manual checking
          because the extractor does not track OCR provenance per field.
        </p>
      )}
      <div className="review-toolbar">
        <div className="search-field">
          <Search size={15} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search parameters"
            aria-label="Search parameters"
          />
        </div>
        <div className="toolbar-right">
          <Badge variant="outline" className="filter-count">
            <Filter size={13} /> {shown.length} parameters
          </Badge>
        </div>
      </div>
      <div className="parameter-table-wrap">
        <table className="parameter-table">
          <thead>
            <tr>
              <th>PARAMETER</th>
              <th>VALUE</th>
              <th>UNIT</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((parameter) => {
              const value = fieldValues[parameter.name] ?? "";
              const needsReview = diagnostics?.manualReviewFields.includes(parameter.name) ?? false;
              const fromOcr = diagnostics?.ocrFields.includes(parameter.name) ?? false;
              const rowClass = [
                value ? "" : "missing-row",
                needsReview ? "review-row-manual" : "",
                fromOcr ? "review-row-ocr" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={parameter.name} className={rowClass}>
                  <td>
                    <strong>{parameter.name}</strong>
                    <span className="parameter-category">{parameter.category}</span>
                  </td>
                  <td>
                    <Input
                      ref={parameter.name === "RecordID" ? recordIdInputRef : undefined}
                      value={value}
                      disabled={
                        !workflowEnabled ||
                        checkingWorkflow ||
                        isReading ||
                        isSaving ||
                        confirming ||
                        savedRowNumber !== null
                      }
                      type="text"
                      inputMode={parameter.kind === "number" ? "decimal" : undefined}
                      aria-label={`Value for ${parameter.name}`}
                      placeholder="Enter or review value"
                      onChange={(event) => {
                        setSaveFeedback(null);
                        setDuplicateExistingRow(null);
                        setFieldValues((current) => ({
                          ...emptyValues(),
                          ...current,
                          [parameter.name]: event.target.value,
                        }));
                      }}
                    />
                  </td>
                  <td className="unit-cell">{parameter.unit ?? "—"}</td>
                  <td>
                    <span className={`review-state ${value ? "review-filled" : "review-missing"}`}>
                      <span />
                      {needsReview
                        ? "Manual review"
                        : fromOcr
                          ? "OCR value"
                          : value
                            ? "Ready to check"
                            : "Empty"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {diagnostics && extractionSupported && (
        <div className="extractor-diagnostics">
          <details>
            <summary>
              Extractor values with no matching page field (
              {diagnostics.unmatchedExtractorFields.length})
            </summary>
            <p>
              {diagnostics.unmatchedExtractorFields.length
                ? diagnostics.unmatchedExtractorFields.join(", ")
                : "None"}
            </p>
          </details>
          <details>
            <summary>
              Page fields this centre's extractor does not map (
              {diagnostics.unmappedPageFields.length})
            </summary>
            <p>
              {diagnostics.unmappedPageFields.length
                ? diagnostics.unmappedPageFields.join(", ")
                : "None"}
            </p>
          </details>
        </div>
      )}
      <div className="review-bottom">
        <div className="review-hint">
          <CircleHelp size={15} />
          <span>
            Empty fields remain blank and can be completed manually. RecordID is required.
          </span>
        </div>
        <div className="review-submit">
          <Button
            className="primary-action"
            disabled={
              !centreName ||
              !workflowEnabled ||
              checkingWorkflow ||
              isReading ||
              isSaving ||
              confirming ||
              savedRowNumber !== null
            }
            onClick={startReviewConfirmation}
          >
            <ClipboardCheck size={16} /> Confirm review <ArrowRight size={15} />
          </Button>
          {!confirming && saveFeedback && (
            <p
              ref={saveResultRef}
              className={`review-save-result review-save-${saveFeedback.kind}`}
              role={saveFeedback.kind === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {saveFeedback.message}
            </p>
          )}
        </div>
      </div>
      {confirming && centreName && (
        <div className="review-confirmation" role="group" aria-label="Confirm destination">
          <strong>Add this row to {centreName}'s sheet?</strong>
          <span>RecordID: {fieldValues["RecordID"]?.trim()}</span>
          {saveFeedback && (
            <p
              ref={saveResultRef}
              className={`review-save-result review-save-${saveFeedback.kind}`}
              role={saveFeedback.kind === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {saveFeedback.message}
            </p>
          )}
          <div>
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                setConfirming(false);
                setDuplicateExistingRow(null);
                setSaveFeedback(null);
              }}
            >
              Go back
            </Button>
            <Button
              className="primary-action"
              disabled={isSaving}
              onClick={() => void saveReviewedRow(duplicateExistingRow !== null)}
            >
              {isSaving
                ? "Adding row..."
                : duplicateExistingRow !== null
                  ? "Add anyway"
                  : "Confirm and add row"}
            </Button>
          </div>
        </div>
      )}
      <div className="workflow-footnote">
        <Info size={14} /> Reports are limited to 15 MB. The extraction service and approved Google
        Sheets access must be enabled before real participant data can be processed.
      </div>
    </TeriipShell>
  );
}

export function ActivityView() {
  const { account } = useTeriipAuth();
  const restrictedCentre =
    account?.role === "centre_admin" || account?.role === "centre_staff" ? account.centreId : null;
  const [filter, setFilter] = useState("All centres");
  const effectiveFilter = restrictedCentre ?? filter;
  const rows: ActivityRow[] = [];
  return (
    <TeriipShell
      eyebrow="WORKSPACE HISTORY"
      title="Recent activity"
      description="Review reports and imports recorded in the workspace."
    >
      <div className="activity-toolbar">
        <div className="activity-count">
          <strong>{rows.length}</strong>
          <span>events</span>
        </div>
        <div className="activity-tools">
          {restrictedCentre ? (
            <span className="activity-centre-lock">{restrictedCentre}</span>
          ) : (
            <>
              <label className="filter-label" htmlFor="activity-centre">
                Centre
              </label>
              <select
                id="activity-centre"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter by centre"
                className="standard-select"
              >
                <option>All centres</option>
                {TERIIP_CENTRES.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </>
          )}
          <Button variant="outline" size="sm" className="quiet-action" disabled>
            <ArrowDownToLine size={15} /> Export view
          </Button>
        </div>
      </div>
      <PageSection
        icon={ClipboardCheck}
        title="Submission history"
        detail="Workflow records and status metadata."
      >
        <ActivityTable
          selectedCentre={effectiveFilter === "All centres" ? undefined : effectiveFilter}
        />
      </PageSection>
      <div className="bottom-note">
        <ShieldCheck size={15} />
        <span>
          No activity is available until an approved data source is connected. Production retention
          settings require institutional approval.
        </span>
      </div>
    </TeriipShell>
  );
}

export function AdminView() {
  return (
    <TeriipShell
      eyebrow="CENTRAL OVERSIGHT"
      title="Admin overview"
      description=""
      children={null}
    />
  );
}
