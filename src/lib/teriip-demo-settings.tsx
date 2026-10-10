import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { TERIIP_CENTRES } from "@/lib/teriip-schema";

type DemoSettingsValue = {
  activeCentre: string;
  setActiveCentre: (centre: string) => void;
  enabledExtensions: Record<string, boolean>;
  setCentreExtensions: (centre: string, enabled: boolean) => void;
};

const DemoSettingsContext = createContext<DemoSettingsValue | null>(null);

export function DemoSettingsProvider({ children }: { children: ReactNode }) {
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

  return <DemoSettingsContext.Provider value={value}>{children}</DemoSettingsContext.Provider>;
}

export function useDemoSettings() {
  const settings = useContext(DemoSettingsContext);
  if (!settings) throw new Error("Demo settings must be used inside DemoSettingsProvider.");
  return settings;
}
