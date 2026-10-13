import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import { listManageableAccounts } from "@/lib/account-management.functions";
import { manageableAccountsQueryOptions } from "@/lib/account-management.queries";
import type { TeriipRole } from "@/lib/teriip-access";
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

function roleLabel(role: TeriipRole) {
  return role === "super_admin" ? "Super Admin" : role === "centre_admin" ? "Centre Admin" : "Centre Staff";
}

export function UserManagementView() {
  const { account } = useTeriipAuth();
  const listAccounts = useServerFn(listManageableAccounts);
  const { data, isPending, isError } = useQuery(manageableAccountsQueryOptions(() => listAccounts()));
  const accounts = (data && typeof data === "object" && "accounts" in data ? data.accounts : []) as AccountRow[];
  const isSuperAdmin = Boolean(data && typeof data === "object" && "actorRole" in data && data.actorRole === "super_admin");
  const availableAccounts = useMemo(() => accounts.filter((item) => item.userId !== account?.id), [account?.id, accounts]);

  return (
    <div className="account-settings-page user-management-page">
      <Link to="/" className="auth-back-link"><ArrowLeft size={14} /> Back to workspace</Link>
      <div className="account-heading-row">
        <div><p className="eyebrow">CENTRE ACCESS</p><h1>Team accounts</h1><p className="page-description">{isSuperAdmin ? "Manage authorized Centre Admins and Staff across TERIIP." : `Manage Centre Staff assigned to ${account?.centreId ?? "your centre"}.`}</p></div>
        <Button disabled title="Secure account provisioning is not configured">Invite account</Button>
      </div>

      <div className="workflow-safety account-provisioning-notice"><ShieldCheck size={16} /><div><strong>Account changes are paused.</strong><span> Secure user-provisioning access and the verified centre email roster are not configured. No invitations or account changes will be claimed as successful.</span></div></div>
      <div className="account-summary"><span><Users size={16} /> {availableAccounts.length} accounts in your scope</span><span><ShieldCheck size={15} /> Account listing is limited to your assigned management scope</span></div>
      {isPending ? <div className="empty-state">Loading accounts in your approved scope…</div> : null}
      {isError ? <div className="auth-message" role="alert">Account details could not be loaded. Your access has not been changed.</div> : null}
      {!isPending && !isError && <div className="table-wrap account-table-wrap"><table className="data-table account-table"><thead><tr><th>ACCOUNT</th><th>ACCESS LEVEL</th><th>CENTRE</th><th>STATUS</th><th>MANAGE</th></tr></thead><tbody>
        {availableAccounts.map((item) => <tr key={item.userId}>
          <td><strong>{item.display_name || item.email || "TERIIP account"}</strong><span className="table-subline">{item.email ?? "Email unavailable"}{item.username ? ` · @${item.username}` : ""}</span></td>
          <td>{roleLabel(item.role)}</td><td>{item.centreId ?? "Headquarters"}</td>
          <td><span className={`mapping-indicator ${item.disabled ? "mapping-review" : ""}`}><span />{item.disabled ? "Disabled" : "Active"}</span></td>
          <td><span className="table-subline">Account changes paused</span></td>
        </tr>)}
      </tbody></table>{availableAccounts.length === 0 && <div className="empty-state">No other accounts are available in your management scope yet.</div>}</div>}
    </div>
  );
}