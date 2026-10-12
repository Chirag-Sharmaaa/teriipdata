import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeTeriipReturnPath, type TeriipRole } from "@/lib/teriip-access";

export type TeriipAccount = {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  emailConfirmed: boolean;
  role: TeriipRole | null;
  centreId: string | null;
  disabled: boolean;
};

type TeriipAuthValue = {
  account: TeriipAccount | null;
  authLoading: boolean;
  signOut: () => Promise<void>;
};

const TeriipAuthContext = createContext<TeriipAuthValue | null>(null);

function minimalAccount(user: User): TeriipAccount {
  const metadataName = user.user_metadata["name"] ?? user.user_metadata["full_name"];
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: typeof metadataName === "string" ? metadataName : null,
    username: null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    role: null,
    centreId: null,
    disabled: false,
  };
}

export function TeriipAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<TeriipAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();
  const generation = useRef(0);

  const hydrateVerifiedUser = useCallback(async (version: number) => {
    const { data, error } = await supabase.auth.getUser();
    if (generation.current !== version) return;
    if (error || !data.user) {
      setAccount(null);
      setAuthLoading(false);
      return;
    }

    const safeUser = data.user;
    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", safeUser.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role, centre_id, disabled_at")
        .eq("user_id", safeUser.id)
        .maybeSingle(),
    ]);
    if (generation.current !== version) return;

    const nextAccount: TeriipAccount = {
      ...minimalAccount(safeUser),
      displayName: profile?.display_name ?? minimalAccount(safeUser).displayName,
      username: profile?.username ?? null,
      role: membership?.role ?? null,
      centreId: membership?.centre_id ?? null,
      disabled: Boolean(membership?.disabled_at),
    };
    setAccount(nextAccount);
    setAuthLoading(false);

    const queuedTarget = window.sessionStorage.getItem("teriip-auth-return");
    if (queuedTarget) {
      window.sessionStorage.removeItem("teriip-auth-return");
      if (window.location.pathname === "/") {
        void router.navigate({ to: safeTeriipReturnPath(queuedTarget) });
      }
    }
  }, [router]);

  useEffect(() => {
    const applySession = (user: User | null) => {
      const version = ++generation.current;
      if (!user) {
        setAccount(null);
        setAuthLoading(false);
        return;
      }
      setAccount(minimalAccount(user));
      setAuthLoading(true);
      void hydrateVerifiedUser(version);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      if (event === "SIGNED_OUT") {
        generation.current += 1;
        setAccount(null);
        setAuthLoading(false);
        queryClient.clear();
        router.invalidate();
        return;
      }
      applySession(session?.user ?? null);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        router.invalidate();
        void queryClient.invalidateQueries();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      generation.current += 1;
    };
  }, [hydrateVerifiedUser, queryClient, router]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth", replace: true });
  }, [queryClient, router]);

  const value = useMemo(() => ({ account, authLoading, signOut }), [account, authLoading, signOut]);

  return <TeriipAuthContext.Provider value={value}>{children}</TeriipAuthContext.Provider>;
}

export function useTeriipAuth() {
  const auth = useContext(TeriipAuthContext);
  if (!auth) throw new Error("TERIIP authentication must be used inside TeriipAuthProvider.");
  return auth;
}