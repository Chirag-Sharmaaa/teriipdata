import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import {
  deleteTeriipAccount,
  inviteTeriipAccount,
  listManageableAccounts,
  setTeriipAccountDisabled,
  updateTeriipAccountAccess,
} from "@/lib/account-management.functions";
import { manageableAccountsQueryOptions } from "@/lib/account-management.queries";
import { isTemporaryLoginEmail, type ManagedRole, type TeriipRole } from "@/lib/teriip-access";
import { TERIIP_CENTRES } from "@/lib/teriip-schema";

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
  return role === "super_admin"
    ? "Super Admin"
    : role === "centre_admin"
      ? "Centre Admin"
      : "Centre Staff";
}

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "That change could not be made.";
}

const selectClass = "teriip-select";

export function UserManagementView() {
  const { account } = useTeriipAuth();
  const queryClient = useQueryClient();
  const listAccounts = useServerFn(listManageableAccounts);
  const invite = useServerFn(inviteTeriipAccount);
  const updateAccess = useServerFn(updateTeriipAccountAccess);
  const setDisabled = useServerFn(setTeriipAccountDisabled);
  const remove = useServerFn(deleteTeriipAccount);
  const { data, isPending, isError } = useQuery(
    manageableAccountsQueryOptions(() => listAccounts()),
  );
  const accounts = (data?.accounts ?? []) as AccountRow[];
  const isSuperAdmin = data?.actorRole === "super_admin";
  const actorCentre = data?.actorCentre ?? account?.centreId ?? null;
  const availableAccounts = accounts.filter((item) => item.userId !== account?.id);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ManagedRole>("centre_staff");
  const [centre, setCentre] = useState<string>(TERIIP_CENTRES[0]);
  const [drafts, setDrafts] = useState<Record<string, { role: ManagedRole; centreId: string }>>({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["teriip", "manageable-accounts"] });
  const onDone = (result: { message: string }) => {
    toast.success(result.message);
    void refresh();
  };
  const onFail = (error: unknown) => toast.error(errorText(error));

  const inviteMutation = useMutation({
    mutationFn: () =>
      invite({
        data: {
          email,
          displayName: name,
          role: isSuperAdmin ? role : "centre_staff",
          centreId: isSuperAdmin ? centre : (actorCentre ?? ""),
        },
      }),
    onSuccess: (result) => {
      onDone(result);
      setEmail("");
      setName("");
    },
    onError: onFail,
  });
  const accessMutation = useMutation({
    mutationFn: (input: { userId: string; role: ManagedRole; centreId: string }) =>
      updateAccess({ data: input }),
    onSuccess: onDone,
    onError: onFail,
  });
  const disableMutation = useMutation({
    mutationFn: (input: { userId: string; disabled: boolean }) => setDisabled({ data: input }),
    onSuccess: onDone,
    onError: onFail,
  });
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: onDone,
    onError: onFail,
  });

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    inviteMutation.mutate();
  }

  return (
    <div className="account-settings-page user-management-page">
      <Link to="/" className="auth-back-link">
        <ArrowLeft size={14} /> Back to workspace
      </Link>
      <div className="account-heading-row">
        <div>
          <p className="eyebrow">CENTRE ACCESS</p>
          <h1>Team accounts</h1>
          <p className="page-description">
            {isSuperAdmin
              ? "Invite, edit, disable and delete Centre Admins and Staff across TERIIP."
              : `Invite and manage Centre Staff for ${actorCentre ?? "your centre"}.`}
          </p>
        </div>
      </div>

      <section className="settings-section">
        <h2>Invite an account</h2>
        <p>
          They receive an email link to confirm their address and choose their own password.
          Passwords are never shown here.
        </p>
        <form className="auth-form invite-form" onSubmit={submitInvite}>
          <label htmlFor="invite-email">Email address</label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="invite-name">Full name (optional)</label>
          <Input
            id="invite-name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {isSuperAdmin ? (
            <>
              <label htmlFor="invite-role">Access level</label>
              <select
                id="invite-role"
                className={selectClass}
                value={role}
                onChange={(event) => setRole(event.target.value as ManagedRole)}
              >
                <option value="centre_admin">Centre Admin</option>
                <option value="centre_staff">Centre Staff</option>
              </select>
              <label htmlFor="invite-centre">Centre</label>
              <select
                id="invite-centre"
                className={selectClass}
                value={centre}
                onChange={(event) => setCentre(event.target.value)}
              >
                {TERIIP_CENTRES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </>
          ) : (
            <p className="table-subline">
              New accounts join {actorCentre ?? "your centre"} as Centre Staff.
            </p>
          )}
          <Button type="submit" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? "Sending invitation…" : "Send invitation"}
          </Button>
        </form>
      </section>

      <div className="account-summary">
        <span>
          <Users size={16} /> {availableAccounts.length} accounts in your scope
        </span>
        <span>
          <ShieldCheck size={15} /> Every change is checked on the server and recorded
        </span>
      </div>
      {isPending ? (
        <div className="empty-state">Loading accounts in your approved scope…</div>
      ) : null}
      {isError ? (
        <div className="auth-message" role="alert">
          Account details could not be loaded. Your access has not been changed.
        </div>
      ) : null}
      {!isPending && !isError && (
        <div className="table-wrap account-table-wrap">
          <table className="data-table account-table">
            <thead>
              <tr>
                <th>ACCOUNT</th>
                <th>ACCESS LEVEL</th>
                <th>CENTRE</th>
                <th>STATUS</th>
                <th>MANAGE</th>
              </tr>
            </thead>
            <tbody>
              {availableAccounts.map((item) => {
                const manageable = item.role !== "super_admin";
                const draft = drafts[item.userId] ?? {
                  role: item.role === "centre_admin" ? "centre_admin" : "centre_staff",
                  centreId: item.centreId ?? TERIIP_CENTRES[0],
                };
                const changed = draft.role !== item.role || draft.centreId !== item.centreId;
                const label = item.display_name || item.username || item.email || "TERIIP account";
                const setupPending = isTemporaryLoginEmail(item.email);
                return (
                  <tr key={item.userId}>
                    <td>
                      <strong>{label}</strong>
                      <span className="table-subline">
                        {setupPending ? "Email not added yet" : (item.email ?? "Email unavailable")}
                        {item.username ? ` · @${item.username}` : ""}
                      </span>
                    </td>
                    <td>
                      {isSuperAdmin && manageable ? (
                        <select
                          aria-label={`Access level for ${label}`}
                          className={selectClass}
                          value={draft.role}
                          onChange={(event) =>
                            setDrafts((all) => ({
                              ...all,
                              [item.userId]: { ...draft, role: event.target.value as ManagedRole },
                            }))
                          }
                        >
                          <option value="centre_admin">Centre Admin</option>
                          <option value="centre_staff">Centre Staff</option>
                        </select>
                      ) : (
                        roleLabel(item.role)
                      )}
                    </td>
                    <td>
                      {isSuperAdmin && manageable ? (
                        <select
                          aria-label={`Centre for ${label}`}
                          className={selectClass}
                          value={draft.centreId}
                          onChange={(event) =>
                            setDrafts((all) => ({
                              ...all,
                              [item.userId]: { ...draft, centreId: event.target.value },
                            }))
                          }
                        >
                          {TERIIP_CENTRES.map((centreName) => (
                            <option key={centreName}>{centreName}</option>
                          ))}
                        </select>
                      ) : (
                        (item.centreId ?? "Headquarters")
                      )}
                    </td>
                    <td>
                      <span className={`mapping-indicator ${item.disabled ? "mapping-review" : ""}`}>
                        <span />
                        {item.disabled ? "Disabled" : setupPending ? "First login pending" : "Active"}
                      </span>
                    </td>
                    <td>
                      {manageable ? (
                        <div className="account-actions">
                          {isSuperAdmin && changed && (
                            <Button
                              size="sm"
                              disabled={accessMutation.isPending}
                              onClick={() =>
                                accessMutation.mutate({ userId: item.userId, ...draft })
                              }
                            >
                              Save
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disableMutation.isPending}
                            onClick={() =>
                              disableMutation.mutate({
                                userId: item.userId,
                                disabled: !item.disabled,
                              })
                            }
                          >
                            {item.disabled ? "Enable" : "Disable"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the account and its access. It cannot
                                  be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(item.userId)}
                                >
                                  Delete account
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <span className="table-subline">Headquarters account</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {availableAccounts.length === 0 && (
            <div className="empty-state">No other accounts are in your management scope yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
