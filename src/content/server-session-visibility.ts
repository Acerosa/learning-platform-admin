/** Hubs that use server-authoritative session visibility (generic RPC). */
const SERVER_SESSION_VISIBILITY_HUBS = new Set([
  "tlevel-software-development",
]);

/**
 * POC gate: T Level Weeks session post/remove uses admin_api.set_session_visibility.
 * Other hubs keep the existing full-package publish path until migrated.
 */
export function supportsServerSessionVisibility(hubCode: string): boolean {
  return SERVER_SESSION_VISIBILITY_HUBS.has(hubCode);
}

export function sessionVisibilityStatusForAction(action: "post" | "remove"): "available" | "planned" {
  return action === "post" ? "available" : "planned";
}
