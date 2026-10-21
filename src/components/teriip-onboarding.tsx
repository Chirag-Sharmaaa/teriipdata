import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFrame, InlineMessage } from "@/components/teriip-auth-pages";
import { useTeriipAuth } from "@/components/teriip-auth-provider";
import { DashboardView } from "@/components/teriip-views";
import { supabase } from "@/integrations/supabase/client";
import {
  completeOnboardingPassword,
  confirmOnboardingEmail,
  submitOnboardingEmail,
} from "@/lib/onboarding.functions";
import { isTemporaryLoginEmail, MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/teriip-access";

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <p className="eyebrow">
      FIRST LOGIN · STEP {step} OF 2 · {step === 1 ? "CONFIRM YOUR EMAIL" : "CHOOSE YOUR PASSWORD"}
    </p>
  );
}

export function OnboardingView() {
  const { account, authLoading, refreshAccount, signOut } = useTeriipAuth();
  const navigate = useNavigate();
  const submitEmail = useServerFn(submitOnboardingEmail);
  const confirmEmail = useServerFn(confirmOnboardingEmail);
  const completePassword = useServerFn(completeOnboardingPassword);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const checkedLink = useRef(false);

  // When the person returns from the emailed link, record that the address is confirmed.
  useEffect(() => {
    if (authLoading || account?.onboarding !== "verify_email" || checkedLink.current) return;
    checkedLink.current = true;
    void confirmEmail()
      .then(async (result) => {
        if (result.ok) {
          await refreshAccount();
          toast.success("Email address confirmed.");
        }
      })
      .catch(() => undefined);
  }, [account?.onboarding, authLoading, confirmEmail, refreshAccount]);

  useEffect(() => {
    if (!authLoading && account && !account.onboarding) void navigate({ to: "/", replace: true });
  }, [account, authLoading, navigate]);

  async function sendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await submitEmail({ data: { email } });
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email: result.email,
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      if (linkError) throw new Error("The confirmation email could not be sent. Try again shortly.");
      setSentTo(result.email);
      checkedLink.current = false;
    } catch (caught) {
      setError(errorText(caught, "Your email address could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    try {
      await completePassword({ data: { password, confirm } });
      await refreshAccount();
      toast.success("Your account is ready.");
      await navigate({ to: "/", replace: true });
    } catch (caught) {
      setError(errorText(caught, "Your password could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading)
    return (
      <AuthFrame>
        <div className="auth-loading">Checking your account…</div>
      </AuthFrame>
    );

  if (!account)
    return (
      <AuthFrame>
        <p className="eyebrow">FIRST LOGIN</p>
        <h1>Sign in to continue</h1>
        <p className="auth-description">
          Sign in with your temporary username and password, or open the latest link we emailed you
          on this device.
        </p>
        <Button asChild className="w-full">
          <Link to="/auth" search={{ next: undefined, flow: undefined }}>
            Go to sign in
          </Link>
        </Button>
      </AuthFrame>
    );

  if (account.onboarding === "password")
    return (
      <AuthFrame>
        <StepIndicator step={2} />
        <h1>Choose your own password</h1>
        <p className="auth-description">
          Your email is confirmed. Replace the temporary password with one only you know (at least{" "}
          {MIN_PASSWORD_LENGTH} characters).
        </p>
        <form className="auth-form" onSubmit={savePassword}>
          <label htmlFor="onboarding-password">New password</label>
          <Input
            id="onboarding-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label htmlFor="onboarding-password-confirm">Confirm new password</label>
          <Input
            id="onboarding-password-confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {error && <InlineMessage message={error} />}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Saving…" : "Save password and open workspace"}
          </Button>
        </form>
      </AuthFrame>
    );

  const waitingFor = sentTo || (account.onboarding === "verify_email" ? account.email : "");
  return (
    <AuthFrame>
      <StepIndicator step={1} />
      <h1>Add your email address</h1>
      <p className="auth-description">
        This becomes your sign-in and is where password-reset links are sent. We will email you a
        confirmation link.
      </p>
      {waitingFor && !isTemporaryLoginEmail(waitingFor) && (
        <div className="auth-message success" role="status">
          <MailCheck size={16} />
          <span>
            Open the confirmation link sent to <strong>{waitingFor}</strong> in this browser. Not
            arrived? Check spam, or send it again below.
          </span>
        </div>
      )}
      <form className="auth-form" onSubmit={sendEmail}>
        <label htmlFor="onboarding-email">Email address</label>
        <Input
          id="onboarding-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {error && <InlineMessage message={error} />}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Sending…" : waitingFor ? "Send confirmation link again" : "Send confirmation link"}
        </Button>
      </form>
      <button type="button" className="auth-back-link" onClick={() => void signOut()}>
        Sign out
      </button>
    </AuthFrame>
  );
}

/** Home: the workspace only opens for signed-in accounts that finished first-login setup. */
export function HomeView() {
  const { account, authLoading, signOut } = useTeriipAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && account?.onboarding) void navigate({ to: "/onboarding", replace: true });
  }, [account, authLoading, navigate]);

  if (authLoading || account?.onboarding)
    return (
      <AuthFrame>
        <div className="auth-loading">Checking your secure access…</div>
      </AuthFrame>
    );

  if (!account)
    return (
      <AuthFrame>
        <p className="eyebrow">SECURE WORKSPACE</p>
        <h1>TERIIP research workspace</h1>
        <p className="auth-description">
          Sign in with the account issued by TERIIP Headquarters to open your centre's workspace.
        </p>
        <Button asChild className="w-full">
          <Link to="/auth" search={{ next: undefined, flow: undefined }}>
            Sign in
          </Link>
        </Button>
      </AuthFrame>
    );

  if (!account.role || account.disabled)
    return (
      <AuthFrame>
        <p className="eyebrow">ACCESS STATUS</p>
        <h1>{account.disabled ? "Account disabled" : "Access pending"}</h1>
        <p className="auth-description">
          {account.disabled
            ? "Contact TERIIP Headquarters to restore access."
            : "No centre has been assigned to this account yet. Contact TERIIP Headquarters."}
        </p>
        <Button variant="outline" className="w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </AuthFrame>
    );

  return <DashboardView />;
}
