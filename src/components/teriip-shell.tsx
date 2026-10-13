import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChevronDown,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileUp,
  FlaskConical,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDemoSettings } from "@/lib/teriip-demo-settings";
import { useTeriipAuth } from "@/components/teriip-auth-provider";

  const navigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "PDF review", to: "/upload", icon: FileUp },
  { label: "Excel import", to: "/import", icon: FileSpreadsheet },
  { label: "Recent activity", to: "/activity", icon: ClipboardList },
  { label: "Admin overview", to: "/admin", icon: Users },
] as const;

export function TeriipShell({
  children,
  eyebrow,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { activeCentre } = useDemoSettings();
  const { account, authLoading, signOut } = useTeriipAuth();
  const activeCentreName = account?.centreId ?? activeCentre;
  const initials = (account?.displayName || account?.email || "DS")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DS";

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link to="/" className="brand-lockup" aria-label="TERIIP home">
          <span className="brand-mark">
            <FlaskConical size={20} strokeWidth={1.8} />
          </span>
          <span>
            <strong>TERIIP</strong>
            <small>Research workspace</small>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.filter((item) => item.to !== "/admin" || !account || account.role === "super_admin").map(({ label, to, icon: Icon }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link key={to} to={to} className={`side-link${active ? " is-active" : ""}`}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <span className="active-mark" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="drive-card">
          <div className="drive-top">
            <span className="connection-dot" /> <span>Drive workspace</span>
          </div>
          <strong>Not connected</strong>
          <p>Demo mode · no files are synced</p>
          <Button variant="outline" size="sm" className="drive-button" asChild>
            <Link to="/admin">
              View setup <ArrowUpRight size={13} />
            </Link>
          </Button>
        </div>
        {account ? (
          <div className="account-nav">
            <Link to="/settings" className="profile-row" aria-label="Account settings">
              <span className="avatar-mark">{initials}</span>
              <span className="profile-copy"><strong>{account.displayName || account.email || "TERIIP account"}</strong><small>{account.role === "super_admin" ? "Super Admin" : account.role === "centre_admin" ? "Centre Admin" : account.role === "centre_staff" ? `${activeCentreName} · Centre Staff` : "Access pending"}</small></span>
              <ChevronDown size={14} />
            </Link>
            <div className="account-links"><Link to="/settings">Settings</Link>{(account.role === "super_admin" || account.role === "centre_admin") && <Link to="/manage-users">Team accounts</Link>}<Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button></div>
          </div>
        ) : authLoading ? (
          <div className="profile-row"><span className="avatar-mark">···</span><span className="profile-copy"><strong>Checking access</strong><small>Secure account</small></span></div>
        ) : (
          <Link to="/auth" search={{ next: undefined, flow: undefined }} className="profile-row" aria-label="Sign in">
            <span className="avatar-mark">DS</span><span className="profile-copy"><strong>Sign in</strong><small>Authorized accounts</small></span><ChevronDown size={14} />
          </Link>
        )}
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="crumb">
            <span>TERIIP</span>
            <span className="crumb-divider">/</span>
            <strong>{navigation.find((item) => item.to === pathname)?.label ?? "Workspace"}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-pill">
              <span /> Demonstration data
            </span>
            <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications">
              <Bell size={17} />
            </Button>
            {account ? <span className="top-avatar">{initials}</span> : <Link to="/auth" search={{ next: undefined, flow: undefined }} className="top-avatar" aria-label="Sign in">DS</Link>}
          </div>
        </header>

        <main className="page-content">
          <div className="demo-notice">
            <ShieldCheck size={15} />
            <span>
              <strong>Safe demo workspace</strong>
              <span>
                {" "}
                Synthetic values only. No real records, reports, or Google Drive connection.
              </span>
            </span>
          </div>
          <section className="page-heading">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p className="page-description">{description}</p>
            </div>
            {actions && <div className="heading-actions">{actions}</div>}
          </section>
          {children}
          <footer className="page-footer">
            <span>
              <Activity size={13} /> Preview workspace
            </span>
            <span>Research data monitoring · Not for clinical decisions</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export function SectionTitle({
  icon: Icon,
  title,
  detail,
  aside,
}: {
  icon: typeof Database;
  title: string;
  detail?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-title-row">
      <div className="section-title">
        <span className="section-icon">
          <Icon size={16} />
        </span>
        <div>
          <h2>{title}</h2>
          {detail && <p>{detail}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}
