import type { CurrentStaffContextRecord } from "../api/admin-api";

export interface AdminSessionSnapshot {
  state:
    | "demo"
    | "loading"
    | "authenticated"
    | "signed-out"
    | "access-denied"
    | "error";
  displayName: string;
  staffReference: string | null;
  roleLabels: readonly string[];
  grantedActions: readonly string[];
  source: "backend" | "demonstration" | "unavailable";
}

export const DEMO_ADMIN_SESSION: AdminSessionSnapshot = Object.freeze({
  state: "demo",
  displayName: "Platform Administrator",
  staffReference: "DEMO-ADMIN",
  roleLabels: ["Platform Administrator"],
  grantedActions: ["*"],
  source: "demonstration",
});

export const SIGNED_OUT_ADMIN_SESSION: AdminSessionSnapshot = Object.freeze({
  state: "signed-out",
  displayName: "Signed out",
  staffReference: null,
  roleLabels: [],
  grantedActions: [],
  source: "backend",
});

export function sessionFromStaffContext(
  context: CurrentStaffContextRecord | null,
): AdminSessionSnapshot {
  if (
    !context ||
    !context.active ||
    !context.activeRoles.includes("platform_admin")
  ) {
    return Object.freeze({
      state: "access-denied",
      displayName: context?.displayName ?? "Authenticated account",
      staffReference: context?.staffReference ?? null,
      roleLabels: context?.activeRoles.map((role) => role.replaceAll("_", " ")) ?? [],
      grantedActions: [],
      source: "backend",
    });
  }

  return Object.freeze({
    state: "authenticated",
    displayName: context.displayName,
    staffReference: context.staffReference,
    roleLabels: context.activeRoles.map((role) => role.replaceAll("_", " ")),
    grantedActions: ["*"],
    source: "backend",
  });
}

export function canAccess(
  session: AdminSessionSnapshot,
  capability: string,
) {
  return (
    session.grantedActions.includes("*") ||
    session.grantedActions.includes(capability)
  );
}
