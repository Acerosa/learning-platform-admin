export interface AdminSessionSnapshot {
  state: "demo" | "authenticated" | "signed-out";
  displayName: string;
  roleLabels: readonly string[];
  grantedActions: readonly string[];
  source: "backend" | "demonstration";
}

export const DEMO_ADMIN_SESSION: AdminSessionSnapshot = Object.freeze({
  state: "demo",
  displayName: "Platform Administrator",
  roleLabels: ["Platform Administrator"],
  grantedActions: ["*"],
  source: "demonstration",
});

export function canAccess(
  session: AdminSessionSnapshot,
  capability: string,
) {
  return (
    session.grantedActions.includes("*") ||
    session.grantedActions.includes(capability)
  );
}
