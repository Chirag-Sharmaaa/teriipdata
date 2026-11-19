import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  FolderSync,
  Gauge,
  Info,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle, TeriipShell } from "@/components/teriip-shell";
import { COMMON_PARAMETERS, CENTRE_EXTENSIONS, TERIIP_CENTRES } from "@/lib/teriip-schema";
import { useWorkspaceSettings } from "@/lib/teriip-workspace-settings";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDriveStats } from "@/lib/drive-stats.functions";

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  color = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Database;
  color?: string;
}) {
  return (
    <div className="metric-block">
      <div className="metric-header">
        <span>{label}</span>
        <span className={`metric-icon metric-${color}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-change">{detail}</div>
    </div>
  );
}

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

export function DashboardView() {
  const { activeCentre: centre, setActiveCentre: setCentre } = useWorkspaceSettings();
  const { account } = useTeriipAuth();
  const isSuperAdmin = account?.role === "super_admin";
  const visibleCentre = account?.centreId ?? centre;
  const displayName = account?.displayName || account?.username || "there";
  const fetchStats = useServerFn(getDriveStats);
  const statsQuery = useQuery({
    queryKey: ["drive-stats", account?.id ?? null],
    queryFn: () => fetchStats(),
    enabled: Boolean(account?.role),
    staleTime: 60_000,
  });
  const stats = statsQuery.data;
  const centres = stats?.centres ?? [];
  const connected = Boolean(stats?.connected);
  const totalRecords = centres.reduce((sum, c) => sum + (c.records ?? 0), 0);
  const withCompleteness = centres.filter((c) => c.completeness !== null);
  const avgCompleteness = withCompleteness.length
    ? Math.round(withCompleteness.reduce((s, c) => s + (c.completeness ?? 0), 0) / withCompleteness.length)
    : null;
  const current = centres.find((c) => c.centre === visibleCentre);
  const loadingText = statsQuery.isLoading ? "Reading Drive…" : undefined;
  const statusText = statsQuery.isError
    ? "Could not reach Drive"
    : connected
      ? "Connected"
      : statsQuery.isLoading
        ? "Checking…"
        : "Not connected";

  return (
    <TeriipShell
      eyebrow={isSuperAdmin ? "HEADQUARTERS WORKSPACE" : "CENTRE WORKSPACE"}
      title={`Good morning, ${displayName}`}
      description="Workspace activity and data availability for your centre."
    >
      {isSuperAdmin && (
        <section className="overall-dashboard" aria-labelledby="overall-dashboard-title">
          <div className="overall-dashboard-heading">
            <div>
              <p className="small-label">HEADQUARTERS · ALL CENTRES</p>
              <h2 id="overall-dashboard-title">Combined overview</h2>
            </div>
          </div>
          <div className="metric-grid">
            <Metric
              label="CONFIGURED CENTRES"
              value={String(TERIIP_CENTRES.length)}
              detail="Defined in workspace"
              icon={Users}
            />
            <Metric
              label="PARTICIPANT RECORDS"
              value={connected ? totalRecords.toLocaleString() : "—"}
              detail={loadingText ?? `Across ${centres.filter((c) => c.records !== null).length} centre datasets`}
              icon={Database}
              color="teal"
            />
            <Metric
              label="DATA COMPLETENESS"
              value={avgCompleteness === null ? "—" : `${avgCompleteness}%`}
              detail="Average filled cells per dataset"
              icon={Gauge}
              color="blue"
            />
            <Metric
              label="DRIVE STATUS"
              value={statusText}
              detail={connected ? "Sample Reports TERIIP PHASE - I" : "Source not reachable"}
              icon={FolderSync}
              color="orange"
            />
          </div>
          <PageSection icon={Database} title="Records by centre" detail="Live counts from each centre's Drive dataset">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CENTRE</th>
                    <th>DATASET</th>
                    <th>RECORDS</th>
                    <th>COMPLETENESS</th>
                    <th>LAST UPDATED</th>
                  </tr>
                </thead>
                <tbody>
                  {centres.map((c) => (
                    <tr key={c.centre}>
                      <td><strong>{c.centre}</strong></td>
                      <td className="type-copy">{c.fileName}</td>
                      <td>{c.error ? <StatusBadge status="Failed" /> : (c.records ?? 0).toLocaleString()}</td>
                      <td>{c.completeness === null ? "—" : `${c.completeness}%`}</td>
                      <td className="date-cell">
                        {c.modifiedTime ? new Date(c.modifiedTime).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {centres.length === 0 && (
                <div className="empty-state">{loadingText ?? "No centre datasets could be read."}</div>
              )}
            </div>
          </PageSection>
        </section>
      )}
      <div className="centre-strip">
        <div className="centre-ident">
          <span className="centre-monogram">
            {visibleCentre
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </span>
          <div>
            <span className="small-label">CURRENT CENTRE</span>
            <strong>{visibleCentre}</strong>
          </div>
        </div>
        <div className="centre-meta">
          <span className="connection-dot" /> {connected ? "Google Drive connected" : "No data source connected"}
          {(isSuperAdmin || !account) && (
            <>
              <span className="meta-divider" />
              <label className="centre-picker-label" htmlFor="dashboard-centre-picker">
                Centre
              </label>
              <select
                id="dashboard-centre-picker"
                className="standard-select centre-picker"
                value={centre}
                onChange={(event) => setCentre(event.target.value)}
                aria-label="Select centre dashboard"
              >
                {TERIIP_CENTRES.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          label="PARTICIPANT RECORDS"
          value={current?.records != null ? current.records.toLocaleString() : "—"}
          detail={loadingText ?? (current?.error ? "Dataset could not be read" : current ? current.fileName : "No dataset available")}
          icon={Users}
        />
        <Metric
          label="DATA COMPLETENESS"
          value={current?.completeness != null ? `${current.completeness}%` : "—"}
          detail="Filled cells in this centre's dataset"
          icon={Gauge}
          color="teal"
        />
        <Metric
          label="PARAMETERS TRACKED"
          value={String(COMMON_PARAMETERS.length)}
          detail="Common schema"
          icon={FlaskConical}
          color="blue"
        />
        <Metric
          label="NEEDS REVIEW"
          value="0"
          detail="No submissions available"
          icon={AlertCircle}
          color="orange"
        />
      </div>

      <div className="dashboard-grid">
        <PageSection
          icon={Activity}
          title="Records over time"
          detail="Monthly record additions"
          aside={
            <Button variant="ghost" size="sm" className="range-button">
              Last 6 months <ChevronDown size={13} />
            </Button>
          }
        >
          <div className="empty-state">
            Monthly history will appear once uploads are recorded through TERIIP.
          </div>
        </PageSection>
        <PageSection icon={FolderSync} title="Workspace status" detail="Drive connection status">
          <div className="sync-status">
            <div className="sync-icon">
              <FolderSync size={19} />
            </div>
            <div>
              <strong>{connected ? "Google Drive connected" : "Google Drive not connected"}</strong>
              <span>{connected ? "Read-only record counts" : "No source is connected"}</span>
            </div>
          </div>
          <div className="sync-list">
            <div>
              <span>Last dataset refresh</span>
              <strong>{current?.modifiedTime ? new Date(current.modifiedTime).toLocaleString() : "Not available"}</strong>
            </div>
            <div>
              <span>Destination workbook</span>
              <strong>{current?.fileName ?? "Not configured"}</strong>
            </div>
            <div>
              <span>Recent submissions</span>
              <strong>0</strong>
            </div>
          </div>
          <div className="subtle-note">
            <Info size={14} /> Datasets are only read for counts; nothing is changed.
          </div>
        </PageSection>
      </div>

      <PageSection
        icon={ClipboardCheck}
        title="Recent activity"
        detail="Latest workflow activity"
        aside={
          <Button variant="outline" size="sm" className="view-all" asChild>
            <Link to="/activity">
              View activity <ArrowRight size={14} />
            </Link>
          </Button>
        }
      >
        <ActivityTable selectedCentre={visibleCentre} />
      </PageSection>

      <div className="bottom-note">
        <ShieldCheck size={15} />
        <span>
          Only record counts are read from Drive; no participant details are shown or stored. Do
          not enter real participant information until approved processing is configured.
        </span>
      </div>
    </TeriipShell>
  );
}

export function UploadView() {
  const { activeCentre, enabledExtensions } = useWorkspaceSettings();
  const [query, setQuery] = useState("");
  const extensionsForCentre = enabledExtensions[activeCentre] ?? false;
  const parameters = extensionsForCentre
    ? [...COMMON_PARAMETERS, ...CENTRE_EXTENSIONS]
    : COMMON_PARAMETERS;
  const shown = parameters.filter((parameter) =>
    `${parameter.name} ${parameter.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <TeriipShell
      eyebrow="RECORD WORKFLOW"
      title="PDF report review"
      description="Review report fields when an approved report source is available."
      actions={
        <Button variant="outline" className="quiet-action" onClick={() => setQuery("")}>
          Reset review
        </Button>
      }
    >
      <div className="workflow-safety">
        <LockKeyhole size={16} />
        <div>
          <strong>No report is available to review.</strong>
          <span>
            {" "}
            Drive is not connected and report processing is not configured. Do not enter real
            participant information here.
          </span>
        </div>
      </div>
      <div className="review-summary-strip">
        <div className="file-symbol">
          <FileText size={20} />
        </div>
        <div className="summary-file">
          <strong>No report selected</strong>
          <span>Waiting for an approved report source</span>
        </div>
        <Badge variant="outline" className="status-badge status-pending">
          <span /> Unavailable
        </Badge>
        <div className="summary-progress">
          <span>0 of {parameters.length} fields populated</span>
          <div className="mini-progress">
            <span style={{ width: "0%" }} />
          </div>
        </div>
      </div>
      <div className="extension-note">
        Common parameters are shown here. Centre-specific parameters remain separate.
      </div>
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
              const isIdentity = parameter.category === "Identity";
              return (
                <tr key={parameter.name} className="missing-row">
                  <td>
                    <strong>{parameter.name}</strong>
                    <span className="parameter-category">{parameter.category}</span>
                  </td>
                  <td>
                    <Input
                      value=""
                      disabled
                      aria-label={`Value for ${parameter.name}`}
                      placeholder={isIdentity ? "Unavailable" : "Not available"}
                    />
                  </td>
                  <td className="unit-cell">{parameter.unit ?? "—"}</td>
                  <td>
                    <span className="review-state review-missing">
                      <span />
                      Waiting for report
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="review-bottom">
        <div className="review-hint">
          <CircleHelp size={15} />
          <span>No report data is available. Extraction has not taken place.</span>
        </div>
        <Button className="primary-action" disabled>
          <ClipboardCheck size={16} /> Confirm review <ArrowRight size={15} />
        </Button>
      </div>
      <div className="workflow-footnote">
        <Info size={14} /> Approved PDF extraction and a verified destination are required before
        this workflow can process data.
      </div>
    </TeriipShell>
  );
}

const importedColumns: {
  source: string;
  canonical: string;
  confidence: "matched" | "review" | "ignored" | "ambiguous";
}[] = [];

export function ImportView() {
  const { activeCentre, enabledExtensions } = useWorkspaceSettings();
  const [mappings, setMappings] = useState(importedColumns.map((column) => column.canonical));
  const [search, setSearch] = useState("");
  const candidates = COMMON_PARAMETERS.filter((parameter) =>
    parameter.name.toLowerCase().includes(search.toLowerCase()),
  ).map((parameter) => parameter.name);
  if (enabledExtensions[activeCentre])
    candidates.push(...CENTRE_EXTENSIONS.map((parameter) => parameter.name));
  const mappedCount = mappings.filter(
    (mapping) => mapping !== "Choose parameter…" && mapping !== "Ignore this column",
  ).length;

  return (
    <TeriipShell
      eyebrow="DATA IMPORT"
      title="Excel column mapping"
      description="Map workbook columns after a workbook source is available."
      actions={
        <Button
          variant="outline"
          className="quiet-action"
          onClick={() => {
            setMappings([]);
            setSearch("");
          }}
        >
          Reset mapping
        </Button>
      }
    >
      <div className="workflow-safety">
        <LockKeyhole size={16} />
        <div>
          <strong>No workbook is available to map.</strong>
          <span>
            {" "}
            Drive is not connected and workbook import is not configured. No file has been read.
          </span>
        </div>
      </div>
      <div className="import-overview">
        <div className="import-file-badge">
          <FileSpreadsheet size={19} />
        </div>
        <div className="summary-file">
          <strong>No workbook selected</strong>
          <span>Workbook details will appear when an approved source is connected.</span>
        </div>
        <div className="import-progress-stat">
          <strong>{mappedCount}</strong>
          <small>COLUMNS MAPPED</small>
        </div>
        <div className="import-flag-stat">
          <strong>0</strong>
          <small>NEED ATTENTION</small>
        </div>
      </div>
      <div className="mapping-callout">
        <AlertCircle size={16} />
        <span>
          <strong>Column mapping is unavailable.</strong> Connect an approved workbook source to
          load columns for review.
        </span>
      </div>
      <div className="extension-note">
        Only source columns from a connected workbook can be mapped. Centre-specific parameters
        remain separate from the common schema.
      </div>
      <PageSection
        icon={SlidersHorizontal}
        title="Column mapping"
        detail="Choose the matching TERIIP field for each source column."
        aside={
          <div className="search-field mapping-search">
            <Search size={14} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a parameter"
              aria-label="Find a parameter"
            />
          </div>
        }
      >
        <div className="mapping-table-wrap">
          <table className="mapping-table">
            <thead>
              <tr>
                <th>SOURCE COLUMN</th>
                <th aria-label="Mapping direction" />
                <th>TERIIP PARAMETER</th>
                <th>REVIEW</th>
              </tr>
            </thead>
            <tbody>
              {importedColumns.map((column, index) => {
                const mapping = mappings[index] ?? "Choose parameter…";
                return (
                  <tr key={column.source}>
                    <td>
                      <div className="source-heading">
                        <span className="sheet-grid">
                          <FileSpreadsheet size={14} />
                        </span>
                        <strong>{column.source}</strong>
                      </div>
                    </td>
                    <td>
                      <ArrowRight size={15} className="mapping-arrow" />
                    </td>
                    <td>
                      <select
                        aria-label={`Match ${column.source}`}
                        value={mapping}
                        onChange={(event) =>
                          setMappings((current) =>
                            current.map((value, currentIndex) =>
                              currentIndex === index ? event.target.value : value,
                            ),
                          )
                        }
                        className={`mapping-select${column.confidence === "ambiguous" || column.confidence === "review" ? " needs-check" : ""}`}
                      >
                        <option value="Choose parameter…">Choose parameter…</option>
                        <option value="Ignore this column">Ignore this column</option>
                        {candidates.map((candidate) => (
                          <option key={candidate} value={candidate}>
                            {candidate}
                          </option>
                        ))}
                        {!candidates.includes(mapping) &&
                          mapping !== "Choose parameter…" &&
                          mapping !== "Ignore this column" && (
                            <option value={mapping}>{mapping}</option>
                          )}
                      </select>
                    </td>
                    <td>
                      <span className={`mapping-indicator mapping-${column.confidence}`}>
                        <span />
                        {column.confidence === "matched"
                          ? "Suggested"
                          : column.confidence === "ignored"
                            ? "Ignored"
                            : "Check match"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="empty-state">No source columns are available.</div>
        </div>
      </PageSection>
      <PageSection
        icon={FileCheck2}
        title="Import preview"
        detail="Rows from the selected workbook will appear here."
      >
        <div className="empty-state">No workbook rows are available.</div>
      </PageSection>
      <div className="import-footer">
        <span>
          <Info size={14} /> No source workbook has been read.
        </span>
        <Button className="primary-action" disabled>
          <ClipboardCheck size={16} /> Confirm mapping <ArrowRight size={15} />
        </Button>
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
  const { account } = useTeriipAuth();
  const [selected, setSelected] = useState("ALL CENTRES");
  const [needle, setNeedle] = useState("");
  const visibleCentres = TERIIP_CENTRES.filter((centre) =>
    centre.toLowerCase().includes(needle.toLowerCase()),
  );

  if (account && account.role !== "super_admin") {
    const centre = account.centreId;
    return (
      <TeriipShell
        eyebrow="CENTRE WORKSPACE"
        title="Admin overview"
        description="Only your assigned centre is available to this account."
      >
        <div className="centre-strip">
          <div className="centre-ident">
            <span className="centre-monogram">{centre?.slice(0, 2).toUpperCase()}</span>
            <div>
              <span className="small-label">ASSIGNED CENTRE</span>
              <strong>{centre}</strong>
            </div>
          </div>
        </div>
        <div className="metric-grid">
          <Metric label="CONFIGURED CENTRES" value="1" detail="Your assigned centre" icon={Users} />
          <Metric
            label="PARTICIPANT RECORDS"
            value="0"
            detail="No Drive data available"
            icon={Database}
            color="teal"
          />
          <Metric
            label="DATA COMPLETENESS"
            value="—"
            detail="No records available"
            icon={Gauge}
            color="blue"
          />
          <Metric
            label="DRIVE STATUS"
            value="Not connected"
            detail="Source not configured"
            icon={FolderSync}
            color="orange"
          />
        </div>
        <PageSection
          icon={ClipboardCheck}
          title="Centre activity"
          detail="Activity recorded for your assigned centre."
        >
          <ActivityTable selectedCentre={centre ?? undefined} />
        </PageSection>
      </TeriipShell>
    );
  }

  return (
    <TeriipShell
      eyebrow="CENTRAL OVERSIGHT"
      title="Admin overview"
      description="Centre configuration and data-source availability."
      actions={
        <Button
          variant="outline"
          className="quiet-action"
          onClick={() => setSelected("ALL CENTRES")}
        >
          <RefreshCw size={15} /> Reset view
        </Button>
      }
    >
      <div className="admin-banner">
        <div className="admin-banner-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <strong>Workspace data unavailable</strong>
          <span>
            {" "}
            No participant data is available until the approved Google Drive source is connected.
            Accounts are managed from Team accounts.
          </span>
        </div>
      </div>
      <div className="admin-selector-row">
        <div>
          <p className="small-label">CENTRE VIEW</p>
          <h2>{selected === "ALL CENTRES" ? "All configured centres" : selected}</h2>
        </div>
        <select
          className="standard-select centre-select"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          aria-label="Select centre"
        >
          <option>ALL CENTRES</option>
          {TERIIP_CENTRES.map((centreName) => (
            <option key={centreName}>{centreName}</option>
          ))}
        </select>
      </div>
      <div className="metric-grid admin-metrics">
        <Metric
          label="CONFIGURED CENTRES"
          value={selected === "ALL CENTRES" ? String(TERIIP_CENTRES.length) : "1"}
          detail="Defined in workspace"
          icon={Users}
        />
        <Metric
          label="PARTICIPANT RECORDS"
          value="0"
          detail="No Drive data available"
          icon={Database}
          color="teal"
        />
        <Metric
          label="AVG. COMPLETENESS"
          value="—"
          detail="No records available"
          icon={Gauge}
          color="blue"
        />
        <Metric
          label="DRIVE STATUS"
          value="Not connected"
          detail="Source not configured"
          icon={FolderSync}
          color="orange"
        />
      </div>
      <div className="admin-grid">
        <PageSection
          icon={Users}
          title="Centre overview"
          detail="Centre configuration and current data availability."
          aside={
            <div className="search-field table-search">
              <Search size={14} />
              <Input
                value={needle}
                onChange={(event) => setNeedle(event.target.value)}
                placeholder="Search centres"
                aria-label="Search centres"
              />
            </div>
          }
        >
          <div className="table-wrap">
            <table className="data-table centre-table">
              <thead>
                <tr>
                  <th>CENTRE</th>
                  <th>PARTICIPANT RECORDS</th>
                  <th>COMPLETENESS</th>
                  <th>CONNECTION</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleCentres.map((centre) => (
                  <tr key={centre} onClick={() => setSelected(centre)} className="clickable-row">
                    <td>
                      <div className="centre-cell">
                        <span className="centre-mini">{centre.slice(0, 2).toUpperCase()}</span>
                        <strong>{centre}</strong>
                      </div>
                    </td>
                    <td>0</td>
                    <td>
                      <div className="completeness-cell">
                        <span className="completeness-track">
                          <span style={{ width: "0%" }} />
                        </span>
                        <strong>—</strong>
                      </div>
                    </td>
                    <td>
                      <span className="connection-status">
                        <span /> Not connected
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`View ${centre}`}
                        title="View centre"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(centre);
                        }}
                      >
                        <ArrowRight size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleCentres.length === 0 && (
            <div className="empty-state">No centre names match that search.</div>
          )}
        </PageSection>
        <div className="admin-side-stack">
          <PageSection
            icon={FolderSync}
            title="Drive setup"
            detail="Connection and write destination"
          >
            <div className="setup-empty">
              <div className="setup-icon">
                <FolderSync size={19} />
              </div>
              <strong>No Drive connection</strong>
              <p>
                Folder IDs, workbook destinations, and institutional credentials are not configured.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Drive configuration is unavailable"
              >
                Configuration unavailable
              </Button>
            </div>
          </PageSection>
          <PageSection icon={Users} title="User management" detail="Centre accounts">
            <div className="setup-empty small-setup">
              <div className="setup-icon">
                <Users size={18} />
              </div>
              <strong>Manage centre accounts</strong>
              <p>Review authorized accounts and manage access within your approved scope.</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/manage-users">Manage accounts</Link>
              </Button>
            </div>
          </PageSection>
        </div>
      </div>
      <PageSection icon={ClipboardCheck} title="Latest activity" detail="Latest workflow activity.">
        <ActivityTable />
      </PageSection>
      <div className="admin-disclaimer">
        <ShieldCheck size={15} />
        <span>
          Production access control, hosting, and data-retention settings must be reviewed and
          approved by the institution.
        </span>
      </div>
    </TeriipShell>
  );
}
