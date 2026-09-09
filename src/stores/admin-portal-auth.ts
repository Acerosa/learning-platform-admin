export type AuthBootstrapEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "PASSWORD_RECOVERY"
  | "USER_UPDATED"
  | string;

export type AdminPortalStatus =
  | "loading"
  | "authenticating"
  | "ready"
  | "signed-out"
  | "access-denied"
  | "recovery"
  | "error";

export type AdminAuthPhase =
  | "unauthenticated"
  | "authenticating"
  | "authorising"
  | "authorised"
  | "forbidden"
  | "recovery"
  | "error";

export const AUTH_USER_MESSAGES = Object.freeze({
  invalidCredentials: "Email or password is incorrect.",
  forbidden: "Your account does not have access to the Admin Portal.",
  sessionExpired: "Your session has expired. Please sign in again.",
  network: "We couldn't sign you in. Please try again.",
  resetSent: "If an account exists for that email, we have sent password reset instructions.",
  recoveryInvalid: "This password reset link is invalid or has expired. Request a new one.",
  passwordUpdated: "Your password has been updated. You can now sign in.",
  magicLinkSent: "Check the staff inbox for a time-limited sign-in link.",
  magicLinkFailed: "A sign-in link could not be sent. Check the staff email and try again.",
  resetFailed: "We couldn't send a password reset email. Please try again.",
  passwordUpdateFailed: "The new password could not be saved. Please try again.",
  passwordMismatch: "Passwords must match.",
});

type AuthErrorLike = {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
} | null | undefined;

function normalisedAuthText(value: string | undefined) {
  return (value ?? "").toLowerCase();
}

export function mapSignInError(error: AuthErrorLike): string {
  if (!error) return AUTH_USER_MESSAGES.network;
  const code = normalisedAuthText(error.code);
  const message = normalisedAuthText(error.message);
  const name = normalisedAuthText(error.name);
  if (
    name.includes("retryable")
    || name.includes("fetcherror")
    || message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("load failed")
  ) {
    return AUTH_USER_MESSAGES.network;
  }
  if (
    code === "invalid_credentials"
    || message.includes("invalid login")
    || message.includes("invalid email or password")
    || message.includes("email not confirmed")
    || message.includes("user not found")
  ) {
    return AUTH_USER_MESSAGES.invalidCredentials;
  }
  if (
    code === "session_not_found"
    || (message.includes("session") && (message.includes("expired") || message.includes("invalid")))
  ) {
    return AUTH_USER_MESSAGES.sessionExpired;
  }
  return AUTH_USER_MESSAGES.network;
}

export function mapPasswordUpdateError(error: AuthErrorLike): string {
  if (!error) return AUTH_USER_MESSAGES.passwordUpdateFailed;
  const message = normalisedAuthText(error.message);
  const name = normalisedAuthText(error.name);
  if (
    name.includes("retryable")
    || name.includes("fetcherror")
    || message.includes("failed to fetch")
    || message.includes("network")
  ) {
    return AUTH_USER_MESSAGES.network;
  }
  if (message.includes("expired") || message.includes("session") || message.includes("invalid")) {
    return AUTH_USER_MESSAGES.recoveryInvalid;
  }
  return AUTH_USER_MESSAGES.passwordUpdateFailed;
}

export function recoveryErrorFromLocation(search = "", hash = ""): string | null {
  const candidates = [search, hash.replace(/^#/, "")];
  for (const candidate of candidates) {
    const query = candidate.includes("?") ? candidate.slice(candidate.indexOf("?") + 1) : candidate;
    const params = new URLSearchParams(query);
    if (params.get("error") || params.get("error_code") || params.get("error_description")) {
      return AUTH_USER_MESSAGES.recoveryInvalid;
    }
  }
  return null;
}

export function shouldEnterPasswordRecovery(
  event: AuthBootstrapEvent,
  location?: { search?: string; hash?: string },
): boolean {
  if (event === "PASSWORD_RECOVERY") return true;
  if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return false;
  const blob = `${location?.search ?? ""} ${location?.hash ?? ""}`;
  return /(?:^|[?&#])type=recovery(?:&|$)/.test(blob);
}

export function shouldBootstrapAdminData(
  event: AuthBootstrapEvent,
  location?: { search?: string; hash?: string },
): boolean {
  if (shouldEnterPasswordRecovery(event, location)) return false;
  return event === "INITIAL_SESSION" || event === "SIGNED_IN";
}

export function shouldClearAdminData(event: AuthBootstrapEvent): boolean {
  return event === "SIGNED_OUT";
}

export function shouldPreservePortalDataOnRefresh(
  current: { status: string; bootstrapReady: boolean },
  options?: { background?: boolean },
): boolean {
  if (options?.background) return true;
  return current.status === "ready" && current.bootstrapReady;
}

export function adminAuthPhase(
  status: AdminPortalStatus,
  bootstrapReady: boolean,
): AdminAuthPhase {
  if (status === "signed-out") return "unauthenticated";
  if (status === "authenticating") return "authenticating";
  if (status === "loading") return bootstrapReady ? "authorised" : "authorising";
  if (status === "ready") return "authorised";
  if (status === "access-denied") return "forbidden";
  if (status === "recovery") return "recovery";
  return "error";
}

export function resolveAdminAuthRedirectUrl(input: {
  origin: string;
  pathname: string;
  usesHashRouting: boolean;
  recovery?: boolean;
}): string {
  const path = input.usesHashRouting ? (input.pathname || "/") : "/";
  const url = new URL(path, input.origin);
  if (input.recovery) url.searchParams.set("type", "recovery");
  return url.toString();
}
