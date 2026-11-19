import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { TERIIP_CENTRES } from "@/lib/teriip-schema";

type WorkspaceSettingsValue = {
  activeCentre: string;
  setActiveCentre: (centre: string) => void;
  enabledExtensions: Record<string, boolean>;
  setCentreExtensions: (centre: string, enabled: boolean) => void;
};

const WorkspaceSettingsContext = createContext<WorkspaceSettingsValue | null>(null);

export function WorkspaceSettingsProvider({ children }: { children: ReactNode }) {
  const [activeCentre, setActiveCentre] = useState<string>(TERIIP_CENTRES[0] ?? "AIIMS Bhopal");
  const [enabledExtensions, setEnabledExtensions] = useState<Record<string, boolean>>({});
  const value = useMemo(
    () => ({
      activeCentre,
      setActiveCentre,
      enabledExtensions,
      setCentreExtensions: (centre: string, enabled: boolean) =>
        setEnabledExtensions((current) => ({ ...current, [centre]: enabled })),
    }),
    [activeCentre, enabledExtensions],
  );

  return (
    <WorkspaceSettingsContext.Provider value={value}>{children}</WorkspaceSettingsContext.Provider>
  );
}

export function useWorkspaceSettings() {
  const settings = useContext(WorkspaceSettingsContext);
  if (!settings)
    throw new Error("Workspace settings must be used inside WorkspaceSettingsProvider.");
  return settings;
}
