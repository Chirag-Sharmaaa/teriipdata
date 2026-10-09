import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleHelp, ClipboardCheck, Database, FileCheck2, FileSpreadsheet, FileText, Filter, FlaskConical, FolderSync, Gauge, Info, LockKeyhole, MoreHorizontal, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Users, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionTitle, TeriipShell } from "@/components/teriip-shell";
import { COMMON_PARAMETERS, CENTRE_EXTENSIONS, TERIIP_CENTRES } from "@/lib/teriip-schema";
import { useDemoSettings } from "@/lib/teriip-demo-settings";
import { demoActivity, demoCentreMetrics, demoTrend } from "@/lib/teriip-demo-data";

const compact = new Intl.NumberFormat("en-IN");

function Metric({ label, value, change, icon: Icon, color = "green" }: { label: string; value: string; change: string; icon: typeof Database; color?: string }) {
  return <div className="metric-block"><div className="metric-header"><span>{label}</span><span className={`metric-icon metric-${color}`}><Icon size={17} /></span></div><div className="metric-value">{value}</div><div className="metric-change"><span className="change-up"><ArrowUpRight size={13} />{change}</span><span>vs last month</span></div></div>;
}

function ActivityTable({ selectedCentre }: { selectedCentre?: string | undefined }) {
  const rows = selectedCentre ? demoActivity.filter((row) => row.centre === selectedCentre) : demoActivity;
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>DEMO RECORD</th><th>ACTIVITY</th><th>DATE</th><th>STATUS</th><th>VALIDATION</th><th aria-label="Actions" /></tr></thead><tbody>{rows.slice(0, 10).map((row) => <tr key={row.id}>
    <td><div className="record-id"><span className="record-icon"><FileText size={15} /></span><strong>{row.id}</strong></div></td>
    <td><span className="type-copy">{row.type}</span>{!selectedCentre && <span className="table-subline">{row.centre}</span>}</td>
    <td className="date-cell">{row.time}</td>
    <td><StatusBadge status={row.status} /></td>
    <td><span className={`validation-text ${row.validation === "Complete" ? "" : "validation-warning"}`}><span />{row.validation}</span></td>
    <td><Button variant="ghost" size="icon" aria-label={`More about ${row.id}`} title="More details"><MoreHorizontal size={17} /></Button></td>
  </tr>)}</tbody></table>{rows.length === 0 && <div className="empty-state">No synthetic activity for this centre yet.</div>}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const type = status === "Verified" || status === "Submitted" || status === "Ready" ? "status-good" : status === "Failed" ? "status-bad" : status === "Duplicate review" || status === "Missing value" || status === "Review" ? "status-warn" : "status-pending";
  return <Badge variant="outline" className={`status-badge ${type}`}><span />{status}</Badge>;
}

function PageSection({ icon, title, detail, aside, children }: { icon: typeof Database; title: string; detail: string; aside?: ReactNode; children: ReactNode }) {
  return <section className="content-section"><SectionTitle icon={icon} title={title} detail={detail} aside={aside} />{children}</section>;
}

export function DashboardView() {
  const { activeCentre: centre, setActiveCentre: setCentre } = useDemoSettings();
  const nextCentre = () => {
    const currentIndex = TERIIP_CENTRES.findIndex((knownCentre) => knownCentre === centre);
    setCentre(TERIIP_CENTRES[(currentIndex + 1) % TERIIP_CENTRES.length] ?? "AIIMS Bhopal");
  };
  const metrics = demoCentreMetrics.find((item) => item.centre === centre) ?? { records: 0, completeness: 0 };
  const totalRecords = demoCentreMetrics.reduce((sum, item) => sum + item.records, 0);

  return <TeriipShell eyebrow="CENTRE WORKSPACE" title="Good morning, Demo staff" description="A clear view of synthetic research data activity for your centre." actions={<Button variant="outline" className="quiet-action" onClick={nextCentre}><RefreshCw size={15} /> Next centre</Button>}>
    <div className="centre-strip"><div className="centre-ident"><span className="centre-monogram">{centre.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span><div><span className="small-label">CURRENT CENTRE</span><strong>{centre}</strong></div></div><div className="centre-meta"><span className="connection-dot" /> Preview data · refreshed just now <span className="meta-divider" /> <Button variant="ghost" size="sm" onClick={nextCentre}>Change centre <ChevronDown size={13} /></Button></div></div>
    <div className="metric-grid">
      <Metric label="PARTICIPANT RECORDS" value={compact.format(metrics.records)} change="8.2%" icon={Users} />
      <Metric label="DATA COMPLETENESS" value={`${metrics.completeness}%`} change="2.4%" icon={Gauge} color="teal" />
      <Metric label="PARAMETERS TRACKED" value={String(COMMON_PARAMETERS.length)} change="Common schema" icon={FlaskConical} color="blue" />
      <Metric label="NEEDS REVIEW" value="08" change="3 new" icon={AlertCircle} color="orange" />
    </div>

    <div className="dashboard-grid">
      <PageSection icon={Activity} title="Records over time" detail="Monthly additions · synthetic dataset" aside={<Button variant="ghost" size="sm" className="range-button">Last 6 months <ChevronDown size={13} /></Button>}>
        <div className="chart-summary"><strong>1,450</strong><span>records added</span><span className="chart-change"><ArrowUpRight size={13} /> 12.8%</span></div>
        <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={demoTrend} margin={{ top: 12, right: 4, bottom: 0, left: -18 }}><defs><linearGradient id="records-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-green)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--chart-green)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} dy={9} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-label)", fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 6, borderColor: "var(--border)", background: "var(--popover)", color: "var(--popover-foreground)" }} /><Area type="monotone" dataKey="records" stroke="var(--chart-green)" strokeWidth={2.5} fill="url(#records-fill)" /></AreaChart></ResponsiveContainer></div>
      </PageSection>
      <PageSection icon={FolderSync} title="Workspace status" detail="Mock Drive connection status">
        <div className="sync-status"><div className="sync-icon"><FolderSync size={19} /></div><div><strong>Google Drive not connected</strong><span>Local preview mode is active</span></div><Badge variant="outline" className="demo-tag">DEMO</Badge></div>
        <div className="sync-list"><div><span>Last dataset refresh</span><strong>Preview data · just now</strong></div><div><span>Destination workbook</span><strong>Not configured</strong></div><div><span>Recent submissions</span><strong>8 this month</strong></div></div>
        <div className="subtle-note"><Info size={14} /> No files have been read or changed.</div>
      </PageSection>
    </div>

      <PageSection icon={ClipboardCheck} title="Recent activity" detail="Latest synthetic workflow examples" aside={<Button variant="outline" size="sm" className="view-all" asChild><Link to="/activity">View activity <ArrowRight size={14} /></Link></Button>}>
      <ActivityTable selectedCentre={centre} />
    </PageSection>

    <div className="bottom-note"><ShieldCheck size={15} /><span><strong>Research monitoring only.</strong> Dashboard values are fabricated and are not for clinical decision-making.</span></div>
  </TeriipShell>;
}

const sampleValues: Record<string, string> = {
  RecordID: "DEMO-NEW-001", Name: "Synthetic Participant", AGE: "34", Gender: "Female", "Blood Group": "O+", Hb: "12.8", PCV: "38.2", TLC: "6.4", "Glucose_Fasting mg/dl": "91", "HbA1c%": "5.4", "TSH μIU/mL": "2.1", "Vitamin_D ng/ml": "24.0",
};

export function UploadView() {
  const { activeCentre, enabledExtensions } = useDemoSettings();
  const [query, setQuery] = useState("");
  const [fields, setFields] = useState(sampleValues);
  const [submitted, setSubmitted] = useState(false);
  const [checked, setChecked] = useState(false);
  const extensionsForCentre = enabledExtensions[activeCentre] ?? false;
  const parameters = extensionsForCentre ? [...COMMON_PARAMETERS, ...CENTRE_EXTENSIONS] : COMMON_PARAMETERS;
  const shown = useMemo(() => parameters.filter((parameter) => `${parameter.name} ${parameter.category}`.toLowerCase().includes(query.toLowerCase())), [query, extensionsForCentre]);
  const populated = Object.values(fields).filter(Boolean).length;

  return <TeriipShell eyebrow="RECORD WORKFLOW" title="PDF report review" description="Explore the review table with a fabricated participant report and synthetic values." actions={<Button variant="outline" className="quiet-action" onClick={() => { setFields(sampleValues); setSubmitted(false); setChecked(false); }}>Reset example</Button>}>
    <div className="workflow-safety"><LockKeyhole size={16} /><div><strong>Real report processing is disabled in this preview.</strong><span> Use the synthetic example below. Do not select, paste, or enter real participant information.</span></div></div>
    {!submitted ? <>
      <div className="review-summary-strip"><div className="file-symbol"><FileText size={20} /></div><div className="summary-file"><strong>synthetic_blood_report.pdf</strong><span>Fabricated example · not a real report</span></div><Badge variant="outline" className="status-badge status-pending"><span /> Needs review</Badge><div className="summary-progress"><span>{populated} of {parameters.length} fields populated</span><div className="mini-progress"><span style={{ width: `${Math.round(populated / parameters.length * 100)}%` }} /></div></div></div>
      <div className="extension-note">Showing fields configured for <strong>{activeCentre}</strong> in Admin overview.</div>
      <div className="review-toolbar"><div className="search-field"><Search size={15} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search parameters" aria-label="Search parameters" /></div><div className="toolbar-right"><Badge variant="outline" className="filter-count"><Filter size={13} /> {shown.length} parameters</Badge><Button variant="outline" size="sm" className="compact-button" onClick={() => setFields({ ...fields, ...sampleValues })}>Fill example values</Button></div></div>
      <div className="parameter-table-wrap"><table className="parameter-table"><thead><tr><th>PARAMETER</th><th>VALUE</th><th>UNIT</th><th>STATUS</th></tr></thead><tbody>{shown.map((parameter) => {
        const value = fields[parameter.name] ?? "";
        const isIdentity = parameter.category === "Identity";
        return <tr key={parameter.name} className={!value ? "missing-row" : ""}><td><strong>{parameter.name}</strong><span className="parameter-category">{parameter.category}</span></td><td><Input value={value} onChange={(event) => setFields({ ...fields, [parameter.name]: event.target.value })} aria-label={`Value for ${parameter.name}`} placeholder={isIdentity ? "Enter value" : "Not provided"} /></td><td className="unit-cell">{parameter.unit ?? "—"}</td><td><span className={`review-state ${value ? "review-filled" : "review-missing"}`}><span />{value ? "Synthetic value" : "Missing"}</span></td></tr>;
      })}</tbody></table></div>
      <div className="review-bottom"><div className="review-hint"><CircleHelp size={15} /><span>All values shown are invented for demonstration. No extraction has taken place.</span></div><label className="confirm-review"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span>I checked this synthetic example against its source</span></label><Button className="primary-action" disabled={!checked} onClick={() => setSubmitted(true)}><ClipboardCheck size={16} /> Confirm demo review <ArrowRight size={15} /></Button></div>
    </> : <div className="success-panel"><div className="success-mark"><Check size={25} /></div><p className="eyebrow">DEMO CONFIRMATION</p><h2>Example review complete</h2><p>This was a simulated confirmation only. No record was saved and no workbook was updated.</p><div className="success-details"><span><CheckCircle2 size={15} /> Synthetic values confirmed</span><span><Database size={15} /> Mock destination · not connected</span></div><Button variant="outline" onClick={() => setSubmitted(false)}>Back to example</Button></div>}
    <div className="workflow-footnote"><Info size={14} /> The production workflow requires approved local PDF extraction and verified destination setup before handling real data.</div>
  </TeriipShell>;
}

const importedColumns = [
  { source: "Participant Code", canonical: "RecordID", confidence: "matched" },
  { source: "Age", canonical: "AGE", confidence: "matched" },
  { source: "Sex", canonical: "Gender", confidence: "matched" },
  { source: "Hb (g/dl)", canonical: "Hb", confidence: "matched" },
  { source: "Fasting Glucose", canonical: "Glucose_Fasting mg/dl", confidence: "review" },
  { source: "Minerals (Cu)", canonical: "Copper ug/dl", confidence: "matched" },
  { source: "Follow-up note", canonical: "Ignore this column", confidence: "ignored" },
  { source: "Blood Type / Rh", canonical: "Choose parameter…", confidence: "ambiguous" },
];

export function ImportView() {
  const { activeCentre, enabledExtensions } = useDemoSettings();
  const [mappings, setMappings] = useState(importedColumns.map((column) => column.canonical));
  const [confirmed, setConfirmed] = useState(false);
  const [search, setSearch] = useState("");
  const candidates = COMMON_PARAMETERS.filter((parameter) => parameter.name.toLowerCase().includes(search.toLowerCase())).map((parameter) => parameter.name);
  if (enabledExtensions[activeCentre]) candidates.push(...CENTRE_EXTENSIONS.map((parameter) => parameter.name));
  const mappedCount = mappings.filter((mapping) => mapping !== "Choose parameter…" && mapping !== "Ignore this column").length;

  return <TeriipShell eyebrow="DATA IMPORT" title="Excel column mapping" description="Review an example workbook mapping with fabricated columns and rows." actions={<Button variant="outline" className="quiet-action" onClick={() => { setMappings(importedColumns.map((column) => column.canonical)); setConfirmed(false); }}>Reset mapping</Button>}>
    <div className="workflow-safety"><LockKeyhole size={16} /><div><strong>Workbook import is simulated.</strong><span> This example uses fixed, fabricated headers. Real files cannot be uploaded or imported.</span></div></div>
    <div className="import-overview"><div className="import-file-badge"><FileSpreadsheet size={19} /></div><div className="summary-file"><strong>synthetic_centre_dataset.xlsx</strong><span>Demo workbook · 2 worksheets · 24 fictional rows</span></div><div className="import-progress-stat"><strong>{mappedCount}<span> / {importedColumns.length}</span></strong><small>COLUMNS MAPPED</small></div><div className="import-flag-stat"><strong>2</strong><small>NEED ATTENTION</small></div></div>
    <div className="mapping-callout"><AlertCircle size={16} /><span><strong>Two columns need your attention.</strong> Confirm uncertain matches; unmatched values are never silently assigned.</span><Button variant="ghost" size="icon" aria-label="Dismiss mapping note"><X size={15} /></Button></div>
    {!confirmed ? <>
      <div className="extension-note">Optional matches follow the fields configured for <strong>{activeCentre}</strong> in Admin overview.</div>
      <PageSection icon={SlidersHorizontal} title="Column mapping" detail="Choose the matching TERIIP field for each source column." aside={<div className="search-field mapping-search"><Search size={14} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a parameter" aria-label="Find a parameter" /></div>}>
        <div className="mapping-table-wrap"><table className="mapping-table"><thead><tr><th>SOURCE COLUMN</th><th aria-label="Mapping direction" /><th>TERIIP PARAMETER</th><th>REVIEW</th></tr></thead><tbody>{importedColumns.map((column, index) => {
          const mapping = mappings[index] ?? "Choose parameter…";
          return <tr key={column.source}>
            <td><div className="source-heading"><span className="sheet-grid"><FileSpreadsheet size={14} /></span><strong>{column.source}</strong></div></td><td><ArrowRight size={15} className="mapping-arrow" /></td><td><select aria-label={`Match ${column.source}`} value={mapping} onChange={(event) => setMappings((current) => current.map((value, currentIndex) => currentIndex === index ? event.target.value : value))} className={`mapping-select${column.confidence === "ambiguous" || column.confidence === "review" ? " needs-check" : ""}`}>
              <option value="Choose parameter…">Choose parameter…</option><option value="Ignore this column">Ignore this column</option>{candidates.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}{!candidates.includes(mapping) && mapping !== "Choose parameter…" && mapping !== "Ignore this column" && <option value={mapping}>{mapping}</option>}
            </select></td><td><span className={`mapping-indicator mapping-${column.confidence}`}><span />{column.confidence === "matched" ? "Suggested" : column.confidence === "ignored" ? "Ignored" : "Check match"}</span></td>
          </tr>;
        })}</tbody></table></div>
      </PageSection>
      <PageSection icon={FileCheck2} title="Import preview" detail="Sample rows after the proposed mapping.">
        <div className="table-wrap"><table className="data-table preview-table"><thead><tr><th>DEMO RECORD</th><th>AGE</th><th>GENDER</th><th>HB</th><th>FASTING GLUCOSE</th><th>ROW STATUS</th></tr></thead><tbody>{[["SYN-1001", "34", "Female", "12.8", "91", "Ready"], ["SYN-1002", "52", "Male", "13.1", "—", "Missing value"], ["SYN-1003", "29", "Female", "—", "104", "Review"]].map(([recordId, ...cells]) => <tr key={recordId}>{cells.slice(0, 4).map((cell, index) => <td key={index} className={index === 0 ? "synthetic-id" : ""}>{cell}</td>)}<td><StatusBadge status={cells[4] ?? "Review"} /></td></tr>)}</tbody></table></div>
      </PageSection>
      <div className="import-footer"><span><Info size={14} /> Demo only · no source workbook was read</span><Button className="primary-action" onClick={() => setConfirmed(true)}><ClipboardCheck size={16} /> Confirm example mapping <ArrowRight size={15} /></Button></div>
    </> : <div className="success-panel"><div className="success-mark"><Check size={25} /></div><p className="eyebrow">DEMO CONFIRMATION</p><h2>Mapping example confirmed</h2><p>This was a simulated review. No spreadsheet rows were imported and no destination was changed.</p><div className="success-details"><span><CheckCircle2 size={15} /> {mappedCount} columns mapped</span><span><Database size={15} /> Mock destination · not connected</span></div><Button variant="outline" onClick={() => setConfirmed(false)}>Back to mapping</Button></div>}
  </TeriipShell>;
}

export function ActivityView() {
  const [filter, setFilter] = useState("All centres");
  const rows = filter === "All centres" ? demoActivity : demoActivity.filter((row) => row.centre === filter);
  return <TeriipShell eyebrow="WORKSPACE HISTORY" title="Recent activity" description="Synthetic examples of review and import workflow statuses.">
    <div className="activity-toolbar"><div className="activity-count"><strong>{rows.length}</strong><span>demo events</span></div><div className="activity-tools"><label className="filter-label">Centre</label><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by centre" className="standard-select"><option>All centres</option>{TERIIP_CENTRES.map((name) => <option key={name}>{name}</option>)}</select><Button variant="outline" size="sm" className="quiet-action"><ArrowDownToLine size={15} /> Export view</Button></div></div>
    <PageSection icon={ClipboardCheck} title="Submission history" detail="Only demo identifiers and status metadata are shown.">
      <ActivityTable selectedCentre={filter === "All centres" ? undefined : filter} />
    </PageSection>
    <div className="bottom-note"><ShieldCheck size={15} /><span>Activity examples do not contain participant health information. Production retention settings need institutional approval.</span></div>
  </TeriipShell>;
}

export function AdminView() {
  const { enabledExtensions, setCentreExtensions } = useDemoSettings();
  const [selected, setSelected] = useState("ALL CENTRES");
  const [extensionCentre, setExtensionCentre] = useState("AIIMS Bhopal");
  const [needle, setNeedle] = useState("");
  const visibleCentres = demoCentreMetrics.filter((item) => item.centre.toLowerCase().includes(needle.toLowerCase()));
  const active = selected === "ALL CENTRES" ? demoCentreMetrics : demoCentreMetrics.filter((item) => item.centre === selected);
  const recordCount = active.reduce((total, item) => total + item.records, 0);
  const avgCompleteness = Math.round(active.reduce((total, item) => total + item.completeness, 0) / active.length);

  return <TeriipShell eyebrow="CENTRAL OVERSIGHT" title="Admin overview" description="Centre-level synthetic data and connection health at a glance." actions={<Button variant="outline" className="quiet-action" onClick={() => setSelected("ALL CENTRES")}><RefreshCw size={15} /> Reset view</Button>}>
    <div className="admin-banner"><div className="admin-banner-icon"><ShieldCheck size={20} /></div><div><strong>Administrator preview</strong><span> All figures are synthetic. No user accounts or centre data are being administered.</span></div><Badge variant="outline" className="demo-tag">DEMO</Badge></div>
    <div className="admin-selector-row"><div><p className="small-label">CENTRE VIEW</p><h2>{selected === "ALL CENTRES" ? "All participating centres" : selected}</h2></div><select className="standard-select centre-select" value={selected} onChange={(event) => setSelected(event.target.value)} aria-label="Select centre"><option>ALL CENTRES</option>{TERIIP_CENTRES.map((centreName) => <option key={centreName}>{centreName}</option>)}</select></div>
    <div className="metric-grid admin-metrics"><Metric label="PARTICIPATING CENTRES" value={selected === "ALL CENTRES" ? "16" : "01"} change="Configured" icon={Users} /><Metric label="SYNTHETIC RECORDS" value={compact.format(recordCount)} change="Demo only" icon={Database} color="teal" /><Metric label="AVG. COMPLETENESS" value={`${avgCompleteness}%`} change="Across selection" icon={Gauge} color="blue" /><Metric label="DRIVE STATUS" value="Offline" change="Not connected" icon={FolderSync} color="orange" /></div>
    <div className="admin-grid">
      <PageSection icon={Users} title="Centre overview" detail="Synthetic records and completeness by centre" aside={<div className="search-field table-search"><Search size={14} /><Input value={needle} onChange={(event) => setNeedle(event.target.value)} placeholder="Search centres" aria-label="Search centres" /></div>}>
        <div className="table-wrap"><table className="data-table centre-table"><thead><tr><th>CENTRE</th><th>DEMO RECORDS</th><th>COMPLETENESS</th><th>CONNECTION</th><th aria-label="Actions" /></tr></thead><tbody>{visibleCentres.map((item) => <tr key={item.centre} onClick={() => setSelected(item.centre)} className="clickable-row"><td><div className="centre-cell"><span className="centre-mini">{item.centre.slice(0, 2).toUpperCase()}</span><strong>{item.centre}</strong></div></td><td>{compact.format(item.records)}</td><td><div className="completeness-cell"><span className="completeness-track"><span style={{ width: `${item.completeness}%` }} /></span><strong>{item.completeness}%</strong></div></td><td><span className="connection-status"><span /> Mock only</span></td><td><Button variant="ghost" size="icon" aria-label={`View ${item.centre}`} title="View centre" onClick={(event) => { event.stopPropagation(); setSelected(item.centre); }}><ArrowUpRight size={15} /></Button></td></tr>)}</tbody></table></div>
        {visibleCentres.length === 0 && <div className="empty-state">No centre names match that search.</div>}
      </PageSection>
      <div className="admin-side-stack">
        <PageSection icon={FlaskConical} title="Optional fields" detail="Configure extensions explicitly by centre"><div className="extension-admin-controls"><label htmlFor="extension-centre">Centre</label><select className="standard-select" id="extension-centre" value={extensionCentre} onChange={(event) => setExtensionCentre(event.target.value)}>{TERIIP_CENTRES.map((centreName) => <option key={centreName}>{centreName}</option>)}</select><p>These are optional schema fields only; the brief does not identify which centre uses them.</p><label className="extension-toggle"><input type="checkbox" checked={enabledExtensions[extensionCentre] ?? false} onChange={(event) => setCentreExtensions(extensionCentre, event.target.checked)} /><span>Enable MRD No and ABO &amp; Rh Blood grouping</span><small>For {extensionCentre}</small></label></div></PageSection>
        <PageSection icon={FolderSync} title="Drive setup" detail="Connection and write destination"><div className="setup-empty"><div className="setup-icon"><FolderSync size={19} /></div><strong>No Drive connection</strong><p>Folder IDs, workbook destinations, and institutional credentials are not configured.</p><Button variant="outline" size="sm" disabled title="Not available in demo">Configuration unavailable</Button></div></PageSection>
        <PageSection icon={Users} title="User management" detail="Centre accounts"><div className="setup-empty small-setup"><div className="setup-icon"><Users size={18} /></div><strong>Account management disabled</strong><p>Secure sign-in and invitations are not available in this preview.</p></div></PageSection>
      </div>
    </div>
    <PageSection icon={ClipboardCheck} title="Latest activity" detail="Combined synthetic activity sample"><ActivityTable /></PageSection>
    <div className="admin-disclaimer"><ShieldCheck size={15} /><span>Production access control, hosting, and data-retention settings must be reviewed and approved by the institution.</span></div>
  </TeriipShell>;
}