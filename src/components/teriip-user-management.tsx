import { useMemo, useState, type FormEvent } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, ShieldCheck, UserRoundCog, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import { inviteTeriipAccount, listManageableAccounts, manageTeriipAccount } from "@/lib/account-management.functions";
import { manageableAccountsQueryOptions } from "@/lib/account-management.queries";
import type { ManagedRole, TeriipRole } from "@/lib/teriip-access";
import { TERIIP_CENTRES } from "@/lib/teriip-schema";
import { Link } from "@tanstack/react-router";

type AccountRow = {
  userId: string;
  role: TeriipRole;
  centreId: string | null;
  disabled: boolean;
  createdAt: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
};

const roles: Array<{ value: ManagedRole; label: string }> = [
  { value: "centre_admin", label: "Centre Admin" },
  { value: "centre_staff", label: "Centre Staff" },
];

function roleLabel(role: TeriipRole) {
  return role === "super_admin" ? "Super Admin" : role === "centre_admin" ? "Centre Admin" : "Centre Staff";
}

export function UserManagementView() {
  const { account } = useTeriipAuth();
  const { data } = useSuspenseQuery(manageableAccountsQueryOptions);
  const reloadAccounts = useServerFn(listManageableAccounts);
  const inviteAccount = useServerFn(inviteTeriipAccount);
  const manageAccount = useServerFn(manageTeriipAccount);
  const queryClient = useQueryClient();
  const accounts = data.accounts as AccountRow[];
  const isSuperAdmin = data.actorRole === "super_admin";
  const allowedCentre = isSuperAdmin ? null : account?.centreId ?? null;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<ManagedRole>(isSuperAdmin ? "centre_admin" : "centre_staff");
  const [centreId, setCentreId] = useState<string>(allowedCentre ?? TERIIP_CENTRES[0]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const availableAccounts = useMemo(() => accounts.filter((item) => item.userId !== account?.id), [account?.id, accounts]);

  async function refreshList() {
    const fresh = await reloadAccounts();
    queryClient.setQueryData(manageableAccountsQueryOptions.queryKey, fresh);
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("invite");
    const result = await inviteAccount({ data: { email, displayName, role, centreId: isSuperAdmin ? centreId : (allowedCentre ?? "") } });
    setBusyId(null);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(result.message);
    setEmail(""); setDisplayName(""); setInviteOpen(false);
    await refreshList();
  }

  async function updateAccount(item: AccountRow) {
    const nextDisplayName = window.prompt("Display name", item.display_name ?? "");
    if (nextDisplayName === null) return;
    const nextUsername = window.prompt("Username (leave blank for none)", item.username ?? "");
    if (nextUsername === null) return;
    const nextRole = isSuperAdmin
      ? (window.prompt("Role: centre_admin or centre_staff", item.role) ?? item.role)
      : item.role;
    if (nextRole !== "centre_admin" && nextRole !== "centre_staff") { toast.error("Choose Centre Admin or Centre Staff."); return; }
    const nextCentre = isSuperAdmin
      ? (window.prompt("Centre name", item.centreId ?? TERIIP_CENTRES[0]) ?? item.centreId)
      : allowedCentre;
    if (!nextCentre || !TERIIP_CENTRES.includes(nextCentre as (typeof TERIIP_CENTRES)[number])) { toast.error("Choose a listed centre."); return; }
    setBusyId(item.userId);
    const result = await manageAccount({ data: { action: "update", userId: item.userId, role: nextRole, centreId: nextCentre, displayName: nextDisplayName.trim(), username: nextUsername.trim() || null } });
    setBusyId(null);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(result.message);
    await refreshList();
  }

  async function changeStatus(item: AccountRow, action: "disable" | "enable") {
    const message = action === "disable"
      ? `Disable ${item.email ?? "this account"}? They will lose access to TERIIP.`
      : `Re-enable ${item.email ?? "this account"}?`;
    if (!window.confirm(message)) return;
    setBusyId(item.userId);
    const result = await manageAccount({ data: { action, userId: item.userId } });
    setBusyId(null);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(result.message);
    await refreshList();
  }

  async function deleteAccount(item: AccountRow) {
    if (!window.confirm(`Permanently delete ${item.email ?? "this account"} and remove their sign-in access? This cannot be undone.`)) return;
    setBusyId(item.userId);
    const result = await manageAccount({ data: { action: "delete", userId: item.userId } });
    setBusyId(null);
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(result.message);
    await refreshList();
  }

  return (
    <div className="account-settings-page user-management-page">
      <Link to="/" className="auth-back-link"><ArrowLeft size={14} /> Back to workspace</Link>
      <div className="account-heading-row">
        <div><p className="eyebrow">CENTRE ACCESS</p><h1>Team accounts</h1><p className="page-description">{isSuperAdmin ? "Manage authorized Centre Admins and Staff across TERIIP." : `Manage Centre Staff assigned to ${allowedCentre ?? "your centre"}.`}</p></div>
        <Button onClick={() => setInviteOpen((open) => !open)}><Plus size={15} /> Invite account</Button>
      </div>

      {inviteOpen && (
        <section className="settings-section invite-panel">
          <div className="invite-panel-heading"><div><h2>Invite a TERIIP account</h2><p>An invitation email lets the recipient verify their address and set a password.</p></div><Button variant="ghost" size="icon" aria-label="Close invitation form" onClick={() => setInviteOpen(false)}><X size={16} /></Button></div>
          <form className="auth-form invite-form" onSubmit={invite}>
            <label htmlFor="invite-name">Display name</label><Input id="invite-name" required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            <label htmlFor="invite-email">Registered email</label><Input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="invite-role">Access level</label><select id="invite-role" className="standard-select" value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}>{roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            {isSuperAdmin && <><label htmlFor="invite-centre">Centre</label><select id="invite-centre" className="standard-select" value={centreId} onChange={(event) => setCentreId(event.target.value)}>{TERIIP_CENTRES.map((name) => <option key={name}>{name}</option>)}</select></>}
            {!isSuperAdmin && <p className="auth-invite-note">Centre assignment is fixed to {allowedCentre ?? "your centre"}.</p>}
            <Button type="submit" disabled={busyId === "invite"}>{busyId === "invite" ? "Sending invitation…" : "Send invitation"}</Button>
          </form>
        </section>
      )}

      <div className="account-summary"><span><Users size={16} /> {availableAccounts.length} accounts in your scope</span><span><ShieldCheck size={15} /> Access changes are recorded</span></div>
      <div className="table-wrap account-table-wrap"><table className="data-table account-table"><thead><tr><th>ACCOUNT</th><th>ACCESS LEVEL</th><th>CENTRE</th><th>STATUS</th><th>MANAGE</th></tr></thead><tbody>
        {availableAccounts.map((item) => <tr key={item.userId}>
          <td><strong>{item.display_name || item.email || "TERIIP account"}</strong><span className="table-subline">{item.email ?? "Email unavailable"}{item.username ? ` · @${item.username}` : ""}</span></td>
          <td>{roleLabel(item.role)}</td><td>{item.centreId ?? "Headquarters"}</td>
          <td><span className={`mapping-indicator ${item.disabled ? "mapping-review" : ""}`}><span />{item.disabled ? "Disabled" : "Active"}</span></td>
          <td><div className="account-actions"><Button variant="outline" size="sm" disabled={busyId === item.userId} onClick={() => void updateAccount(item)}><UserRoundCog size={14} /> Edit</Button><Button variant="outline" size="sm" disabled={busyId === item.userId} onClick={() => void changeStatus(item, item.disabled ? "enable" : "disable")}>{item.disabled ? "Enable" : "Disable"}</Button><Button variant="destructive" size="sm" disabled={busyId === item.userId} onClick={() => void deleteAccount(item)}>Delete</Button></div></td>
        </tr>)}
      </tbody></table>{availableAccounts.length === 0 && <div className="empty-state">No other accounts are available in your management scope yet.</div>}</div>
    </div>
  );
}