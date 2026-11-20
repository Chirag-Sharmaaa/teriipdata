import { useRef, useState, type ReactNode } from "react";
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
  FileText,
  Filter,
  FlaskConical,
  FolderSync,
  Gauge,
  Info,
  LockKeyhole,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle, TeriipShell, useDriveConnection } from "@/components/teriip-shell";
import { COMMON_PARAMETERS, CENTRE_EXTENSIONS, TERIIP_CENTRES } from "@/lib/teriip-schema";
import { useWorkspaceSettings } from "@/lib/teriip-workspace-settings";
import { useTeriipAuth } from "@/components/teriip-auth-provider";

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
  const statsQuery = useDriveConnection();
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
  const [pdfSelected, setPdfSelected] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        <Button
          variant="outline"
          className="quiet-action"
          onClick={() => {
            setQuery("");
            setPdfSelected(false);
            setUploadMessage(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        >
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
      <div className="pdf-upload-controls">
        <div className="pdf-file-control">
          <label htmlFor="report-pdf">Participant report (PDF)</label>
          <Input
            ref={fileInputRef}
            id="report-pdf"
            type="file"
            accept="application/pdf,.pdf"
            aria-label="Choose a participant PDF report"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              const isPdf = Boolean(
                file &&
                  (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")),
              );
              setPdfSelected(isPdf);
              setUploadMessage(file && !isPdf ? "Please select a PDF file." : null);
            }}
          />
        </div>
        <Button
          className="primary-action"
          disabled={!pdfSelected}
          onClick={() =>
            setUploadMessage(
              "The PDF was not sent. Report extraction and Drive updates are not configured yet.",
            )
          }
        >
          <FileText size={16} /> Upload PDF
        </Button>
      </div>
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
    />
  );
}
