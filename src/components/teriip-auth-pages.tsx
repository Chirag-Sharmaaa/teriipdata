import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  KeyRound,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { isTemporaryLoginEmail, safeTeriipReturnPath } from "@/lib/teriip-access";
import { signInTeriipAccount } from "@/lib/auth-login.functions";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="teriip-auth-frame">
      <section className="teriip-auth-panel">
        <Link to="/" className="auth-brand" aria-label="TERIIP workspace">
          <span className="brand-mark">
            <FlaskConical size={20} strokeWidth={1.8} />
          </span>
          <span>
            <strong>TERIIP</strong>
            <small>Research workspace</small>
          </span>
        </Link>
        {children}
        <p className="auth-privacy-note">
          <ShieldCheck size={14} /> Authorized TERIIP accounts only
        </p>
      </section>
      <p className="auth-footer">Research data monitoring · Not for clinical decisions</p>
    </main>
  );
}

export function InlineMessage({
  message,
  kind = "error",
}: {
  message: string;
  kind?: "error" | "success";
}) {
  return (
    <div className={`auth-message ${kind}`} role={kind === "error" ? "alert" : "status"}>
      {kind === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
      <span>{message}</span>
    </div>
  );
}

export function AuthView() {
  const { next, flow } = useSearch({ from: "/auth" });
  const { account, authLoading, signOut } = useTeriipAuth();
  const navigate = useNavigate({ from: "/auth" });
  const signInAccount = useServerFn(signInTeriipAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [confirmInvitePassword, setConfirmInvitePassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loginLockedUntil, setLoginLockedUntil] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.sessionStorage.getItem("teriip-login-lock") ?? "0");
  });

  const destination = safeTeriipReturnPath(next);
  const finishLogin = useCallback(async () => {
    await navigate({ to: destination, replace: true });
  }, [destination, navigate]);

  useEffect(() => {
    if (authLoading || !account || flow) return;
    if (account.onboarding) {
      void navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (account.role && !account.disabled) void finishLogin();
  }, [account, authLoading, finishLogin, flow, navigate]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const now = Date.now();
    if (loginLockedUntil > now) {
      const minutes = Math.ceil((loginLockedUntil - now) / 60_000);
      setError(
        `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    let signInFailed = false;
    try {
      const session = await signInAccount({ data: { identifier: email, password } });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      signInFailed = Boolean(sessionError);
    } catch {
      signInFailed = true;
    }
    setBusy(false);
    if (signInFailed) {
      const attempts = Number(window.sessionStorage.getItem("teriip-login-attempts") ?? "0") + 1;
      window.sessionStorage.setItem("teriip-login-attempts", String(attempts));
      if (attempts >= 5) {
        const lockUntil = Date.now() + 15 * 60_000;
        window.sessionStorage.setItem("teriip-login-lock", String(lockUntil));
        setLoginLockedUntil(lockUntil);
        window.sessionStorage.removeItem("teriip-login-attempts");
        setError("Too many sign-in attempts. Try again in 15 minutes.");
        return;
      }
      setError("Sign-in failed. Check your email or temporary username and password.");
      return;
    }
    window.sessionStorage.removeItem("teriip-login-attempts");
    window.sessionStorage.removeItem("teriip-login-lock");
  }

  async function sendReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    if (!email.includes("@")) {
      setBusy(false);
      setError(
        "Temporary usernames have no email for reset links. Ask TERIIP Headquarters for help, then add your email at first login.",
      );
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );
    setBusy(false);
    if (resetError) {
      setError(
        "We could not send the reset email. Check the address or contact your TERIIP administrator.",
      );
      return;
    }
    setSuccess(
      "If that address belongs to a TERIIP account, a password reset link will arrive by email.",
    );
  }

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (invitePassword.length < 12) {
      setError("Use at least 12 characters for your new password.");
      return;
    }
    if (invitePassword !== confirmInvitePassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: invitePassword });
    setBusy(false);
    if (updateError) {
      setError(
        "Your password could not be set. Reopen the latest invitation link or ask your administrator to resend it.",
      );
      return;
    }
    toast.success("Your password is set.");
    await navigate({ to: "/", replace: true });
  }

  if (flow === "invite") {
    if (authLoading)
      return (
        <AuthFrame>
          <div className="auth-loading">Checking your invitation…</div>
        </AuthFrame>
      );
    if (!account) {
      return (
        <AuthFrame>
          <p className="eyebrow">ACCOUNT INVITATION</p>
          <h1>Check your email</h1>
          <p className="auth-description">
            Open the TERIIP invitation link from your email to verify your address and set a
            password.
          </p>
          <div className="auth-message success">
            <MailCheck size={16} />
            <span>
              The invitation link is personal and expires. Ask your administrator to send a new one
              if it has expired.
            </span>
          </div>
          <Link to="/auth" search={{ next: undefined, flow: undefined }} className="auth-back-link">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </AuthFrame>
      );
    }
    return (
      <AuthFrame>
        <p className="eyebrow">ACCOUNT INVITATION</p>
        <h1>Set your password</h1>
        <p className="auth-description">
          Your address is verified. Choose a password before opening your TERIIP workspace.
        </p>
        <form className="auth-form" onSubmit={acceptInvite}>
          <label htmlFor="invite-password">New password</label>
          <Input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={invitePassword}
            onChange={(event) => setInvitePassword(event.target.value)}
          />
          <label htmlFor="invite-password-confirm">Confirm new password</label>
          <Input
            id="invite-password-confirm"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={confirmInvitePassword}
            onChange={(event) => setConfirmInvitePassword(event.target.value)}
          />
          {error && <InlineMessage message={error} />}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Saving…" : "Set password"}
          </Button>
        </form>
      </AuthFrame>
    );
  }

  if (authLoading)
    return (
      <AuthFrame>
        <div className="auth-loading">Checking your secure access…</div>
      </AuthFrame>
    );

  if (account) {
    return (
      <AuthFrame>
        <p className="eyebrow">ACCESS STATUS</p>
        <h1>Account access is pending</h1>
        <p className="auth-description">
          This account does not yet have an active TERIIP centre role. Contact an authorized
          administrator.
        </p>
        <div className="auth-message success">
          <ShieldCheck size={16} />
          <span>
            {account.disabled
              ? "This account is disabled. Contact an authorized TERIIP administrator to restore access."
              : "Your sign-in is confirmed; no centre data is available until an administrator assigns access."}
          </span>
        </div>
        <Button variant="outline" className="w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </AuthFrame>
    );
  }

  if (forgotMode) {
    return (
      <AuthFrame>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Reset your password</h1>
        <p className="auth-description">
          Enter the email address registered with your TERIIP account.
        </p>
        <form className="auth-form" onSubmit={sendReset}>
          <label htmlFor="reset-email">Email address</label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error && <InlineMessage message={error} />}
          {success && <InlineMessage message={success} kind="success" />}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Sending…" : "Email reset link"}
          </Button>
        </form>
        <button
          type="button"
          className="auth-back-link"
          onClick={() => {
            setForgotMode(false);
            setError("");
            setSuccess("");
          }}
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <p className="eyebrow">SECURE WORKSPACE</p>
      <h1>Sign in to TERIIP</h1>
      <p className="auth-description">
        Use your email, or the temporary username given to you by TERIIP Headquarters.
      </p>
      <form className="auth-form" onSubmit={signIn}>
        <label htmlFor="login-email">Email or temporary username</label>
        <Input
          id="login-email"
          type="text"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="auth-label-row">
          <label htmlFor="login-password">Password</label>
          <button
            type="button"
            className="auth-text-button"
            onClick={() => {
              setForgotMode(true);
              setError("");
            }}
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <InlineMessage message={error} />}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="auth-invite-note">
        <KeyRound size={13} /> Access is by invitation only. Public account creation is disabled.
      </p>
    </AuthFrame>
  );
}

export function ResetPasswordView() {
  const navigate = useNavigate({ from: "/reset-password" });
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    const hashType = new URLSearchParams(window.location.hash.slice(1)).get("type");
    void supabase.auth.getSession().then(({ data }) => {
      if (current) setRecoveryReady(hashType === "recovery" && Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setRecoveryReady(true);
    });
    return () => {
      current = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword.length < 12) {
      setError("Use at least 12 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (updateError) {
      setError("Your password could not be updated. Request a fresh reset link and try again.");
      return;
    }
    toast.success("Your password was updated.");
    await navigate({ to: "/", replace: true });
  }

  return (
    <AuthFrame>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1>Set a new password</h1>
      {!recoveryReady ? (
        <>
          <p className="auth-description">
            Open the password-reset link sent to your registered email address to continue.
          </p>
          <Link to="/auth" search={{ next: undefined, flow: undefined }} className="auth-back-link">
            <ArrowLeft size={14} /> Return to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="auth-description">Choose a new password and confirm it below.</p>
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="new-password">New password</label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <label htmlFor="confirm-password">Confirm new password</label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {error && <InlineMessage message={error} />}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Saving…" : "Set new password"}
            </Button>
          </form>
        </>
      )}
    </AuthFrame>
  );
}

export function SettingsView() {
  const { account, signOut } = useTeriipAuth();
  const [displayName, setDisplayName] = useState(account?.displayName ?? "");
  const [username, setUsername] = useState(account?.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;
    setSavingProfile(true);
    setError("");
    setMessage("");
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        username: username.trim() || null,
      })
      .eq("id", account.id);
    setSavingProfile(false);
    if (profileError)
      setError("Your details could not be saved. Check whether the username is already in use.");
    else {
      setMessage("Your account details have been saved.");
      toast.success("Account details saved.");
    }
  }

  async function resendVerification() {
    if (!account?.email) return;
    setError("");
    setMessage("");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: account.email,
    });
    if (resendError)
      setError("A verification message could not be sent. Contact your TERIIP administrator.");
    else setMessage("A new verification link has been sent to your registered email address.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (newPassword.length < 12) {
      setError("Use at least 12 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setSavingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    setSavingPassword(false);
    if (updateError) {
      setError("Your password was not changed. Check your current password and try again.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Your password has been changed.");
    toast.success("Password changed.");
  }

  return (
    <div className="app-frame">
      <main className="account-settings-page">
        <Link to="/" className="auth-back-link">
          <ArrowLeft size={14} /> Back to workspace
        </Link>
        <p className="eyebrow">ACCOUNT SECURITY</p>
        <h1>Settings</h1>
        <p className="page-description">Manage your account details and sign-in security.</p>
        {!account?.emailConfirmed && !isTemporaryLoginEmail(account?.email) && (
          <section className="settings-section verify-section">
            <div>
              <MailCheck size={18} />
              <div>
                <strong>Email verification needed</strong>
                <p>Verify {account?.email} to keep your account secure.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void resendVerification()}>
              Send verification link
            </Button>
          </section>
        )}
        {error && <InlineMessage message={error} />}
        {message && <InlineMessage message={message} kind="success" />}
        <section className="settings-section">
          <h2>Account details</h2>
          <p>Your access level and centre are managed by your TERIIP administrator.</p>
          <form className="auth-form" onSubmit={saveProfile}>
            <label htmlFor="settings-email">Registered email</label>
            <Input
              id="settings-email"
              type="email"
              value={
                isTemporaryLoginEmail(account?.email) ? "Not added yet" : (account?.email ?? "")
              }
              readOnly
            />
            <label htmlFor="settings-name">Display name</label>
            <Input
              id="settings-name"
              value={displayName}
              maxLength={120}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <label htmlFor="settings-username">Username</label>
            <Input
              id="settings-username"
              value={username}
              maxLength={60}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save details"}
            </Button>
          </form>
        </section>
        <section className="settings-section">
          <h2>Change password</h2>
          <p>Enter your current password before choosing a replacement.</p>
          <form className="auth-form" onSubmit={changePassword}>
            <label htmlFor="current-password">Current password</label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <label htmlFor="settings-new-password">New password</label>
            <Input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <label htmlFor="settings-confirm-password">Confirm new password</label>
            <Input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "Changing…" : "Change password"}
            </Button>
          </form>
        </section>
        <div className="settings-signout">
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </main>
    </div>
  );
}
