export type AuthBootstrapEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | string;

export function shouldBootstrapAdminData(event: AuthBootstrapEvent): boolean {
  return event === "INITIAL_SESSION" || event === "SIGNED_IN";
}

export function shouldClearAdminData(event: AuthBootstrapEvent): boolean {
  return event === "SIGNED_OUT";
}

export function shouldPreservePortalDataOnRefresh(
  current: { status: string; data: unknown | null },
  options?: { background?: boolean },
): boolean {
  if (options?.background) return true;
  return current.status === "ready" && current.data !== null;
}
