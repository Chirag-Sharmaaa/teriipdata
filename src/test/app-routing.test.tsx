import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { CENTRE_EXTENSIONS, COMMON_PARAMETERS, TERIIP_CENTRES } from "@/lib/teriip-schema";
import {
  canManageTeriipRole,
  centreForWorkspace,
  isTemporaryLoginEmail,
  onboardingStage,
  passwordProblem,
  safeAccountLinkOrigin,
  safeTeriipReturnPath,
  teriipLoginEmail,
} from "@/lib/teriip-access";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches every TERIIP workspace page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    for (const path of [
      "/upload",
      "/activity",
      "/admin",
      "/auth",
      "/reset-password",
      "/settings",
      "/manage-users",
      "/onboarding",
    ]) {
      expect(router.matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });
});

describe("TERIIP access boundaries", () => {
  it("lets a Centre Admin manage Staff only in the same centre", () => {
    expect(canManageTeriipRole("centre_admin", "centre_staff", "Delhi", "Delhi")).toBe(true);
    expect(canManageTeriipRole("centre_admin", "centre_staff", "Delhi", "Guwahati")).toBe(false);
    expect(canManageTeriipRole("centre_admin", "centre_admin", "Delhi", "Delhi")).toBe(false);
  });

  it("lets the Super Admin manage centre roles but not another Super Admin", () => {
    expect(canManageTeriipRole("super_admin", "centre_admin", null, "Delhi")).toBe(true);
    expect(canManageTeriipRole("super_admin", "centre_staff", null, "Guwahati")).toBe(true);
    expect(canManageTeriipRole("super_admin", "super_admin", null, null)).toBe(false);
  });

  it("only returns approved in-app pages from a sign-in redirect", () => {
    expect(safeTeriipReturnPath("/activity?filter=Delhi")).toBe("/activity");
    expect(safeTeriipReturnPath("/import")).toBe("/");
    expect(safeTeriipReturnPath("https://attacker.example/")).toBe("/");
    expect(safeTeriipReturnPath("/unknown")).toBe("/");
  });

  it("locks centre users to their assigned centre while allowing workspace centre selection", () => {
    expect(centreForWorkspace("centre_staff", "Delhi", "AIIMS Bhopal")).toBe("Delhi");
    expect(centreForWorkspace("centre_admin", "Guwahati", "Delhi")).toBe("Guwahati");
    expect(centreForWorkspace(null, null, "Delhi")).toBe("Delhi");
  });
});

describe("TERIIP parameter schema", () => {
  it("preserves the full canonical list in its documented order", () => {
    expect(COMMON_PARAMETERS[0]?.name).toBe("RecordID");
    expect(COMMON_PARAMETERS[1]?.name).toBe("Name");
    expect(COMMON_PARAMETERS.at(-1)?.name).toBe("PBS");
    expect(new Set(COMMON_PARAMETERS.map((parameter) => parameter.name)).size).toBe(
      COMMON_PARAMETERS.length,
    );
    // The brief's explicit column list contains 72 entries, despite referring to 66–67.
    expect(COMMON_PARAMETERS).toHaveLength(72);
  });

  it("keeps centre extensions separate from the common schema", () => {
    expect(TERIIP_CENTRES).toHaveLength(16);
    expect(CENTRE_EXTENSIONS.map((parameter) => parameter.name)).toEqual([
      "MRD No",
      "ABO & Rh Blood grouping",
    ]);
    expect(COMMON_PARAMETERS.some((parameter) => parameter.name === "MRD No")).toBe(false);
  });
});

describe("TERIIP first-login accounts", () => {
  it("signs temporary usernames in on the reserved undeliverable domain", () => {
    expect(teriipLoginEmail("  AIIMS-Bhopal-Admin ")).toBe(
      "aiims-bhopal-admin@temp-login.teriip.invalid",
    );
    expect(teriipLoginEmail("Chirag.ICMR@gmail.com")).toBe("chirag.icmr@gmail.com");
    expect(isTemporaryLoginEmail("delhi-admin@temp-login.teriip.invalid")).toBe(true);
    expect(isTemporaryLoginEmail("chirag.icmr@gmail.com")).toBe(false);
  });

  it("reads only known first-login steps from account metadata", () => {
    expect(onboardingStage({ teriip_onboarding: "email" })).toBe("email");
    expect(onboardingStage({ teriip_onboarding: "password" })).toBe("password");
    expect(onboardingStage({ teriip_onboarding: null })).toBeNull();
    expect(onboardingStage({ teriip_onboarding: "admin" })).toBeNull();
  });

  it("requires a 12-character matching password", () => {
    expect(passwordProblem("short", "short")).not.toBeNull();
    expect(passwordProblem("twelve-chars", "twelve-chars")).toBeNull();
    expect(passwordProblem("twelve-chars", "twelve-charz")).toBe("The passwords do not match.");
  });

  it("only sends account links back to allowed TERIIP sites", () => {
    expect(safeAccountLinkOrigin("http://localhost:8080")).toBe("http://localhost:8080");
    expect(safeAccountLinkOrigin("https://attacker.example")).toBeNull();
  });

  it("allows only exact deployment origins configured for account links", () => {
    const previous = process.env["TERIIP_AUTH_REDIRECT_ORIGINS"];
    process.env["TERIIP_AUTH_REDIRECT_ORIGINS"] = "https://teriip.example,https://admin.example";
    try {
      expect(safeAccountLinkOrigin("https://teriip.example")).toBe("https://teriip.example");
      expect(safeAccountLinkOrigin("https://teriip.example.attacker.invalid")).toBeNull();
    } finally {
      if (previous === undefined) delete process.env["TERIIP_AUTH_REDIRECT_ORIGINS"];
      else process.env["TERIIP_AUTH_REDIRECT_ORIGINS"] = previous;
    }
  });
});
