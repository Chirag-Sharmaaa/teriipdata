import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ChevronDown,
  ClipboardList,
  Database,
  FileUp,
  FlaskConical,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspaceSettings } from "@/lib/teriip-workspace-settings";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDriveStats } from "@/lib/drive-stats.functions";

const navigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "PDF review", to: "/upload", icon: FileUp },
  { label: "Recent activity", to: "/activity", icon: ClipboardList },
  { label: "Admin overview", to: "/admin", icon: Users },
] as const;

export function useDriveConnection() {
  const { account } = useTeriipAuth();
  const fetchStats = useServerFn(getDriveStats);
  const queryKey = ["drive-stats", account?.id ?? null];
  const query = useQuery({
    queryKey,
    queryFn: () => fetchStats({ data: { forceRefresh: true } }),
    enabled: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const refreshNow = async () => {
    const result = await query.refetch({ throwOnError: true });
    if (!result.data) throw new Error("Dashboard refresh returned no data.");
    return result.data;
  };
  return { ...query, refreshNow };
}

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
  const { activeCentre } = useWorkspaceSettings();
  const { account, authLoading, signOut } = useTeriipAuth();
  const driveQuery = useDriveConnection();
  const driveConnected = Boolean(driveQuery.data?.connected);
  const activeCentreName = account?.centreId ?? activeCentre;
  const initials =
    (account?.displayName || account?.username || "TERIIP")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "T";

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
          {navigation
            .filter((item) => item.to !== "/admin" || account?.role === "super_admin")
            .map(({ label, to, icon: Icon }) => {
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
        {account ? (
          <div className="account-nav">
            <Link to="/settings" className="profile-row" aria-label="Account settings">
              <span className="avatar-mark">{initials}</span>
              <span className="profile-copy">
                <strong>{account.displayName || account.username || "TERIIP account"}</strong>
                <small>
                  {account.role === "super_admin"
                    ? "Super Admin"
                    : account.role === "centre_admin"
                      ? `${activeCentreName} · Centre Admin`
                      : account.role === "centre_staff"
                        ? `${activeCentreName} · Centre Staff`
                        : "Access pending"}
                </small>
              </span>
              <ChevronDown size={14} />
            </Link>
            <div className="account-links">
              <Link to="/settings">Settings</Link>
              {(account.role === "super_admin" || account.role === "centre_admin") && (
                <Link to="/manage-users">Team accounts</Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <div className="profile-row">
            <span className="avatar-mark">···</span>
            <span className="profile-copy">
              <strong>{authLoading ? "Checking access" : "Signed out"}</strong>
              <small>Secure account</small>
            </span>
          </div>
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
              <span className={driveConnected ? "is-connected" : ""} />
              {driveQuery.isFetching
                ? "Checking Drive…"
                : driveQuery.isError
                  ? "Drive status unavailable"
                  : driveConnected
                    ? "Drive connected · read-only"
                    : driveQuery.data?.status === "disabled"
                      ? "Drive reads disabled"
                      : driveQuery.data?.status === "missing_credentials"
                        ? "Drive credentials missing"
                        : driveQuery.data
                          ? "Drive not connected"
                          : "Drive not checked"}
            </span>
            <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications">
              <Bell size={17} />
            </Button>
            <span className="top-avatar">{initials}</span>
          </div>
        </header>

        <main className="page-content">
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
              <Activity size={13} /> Secure workspace
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
