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
  | "recovery-continue"
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

const AUTH_CALLBACK_PARAM_KEYS = [
  "code",
  "token_hash",
  "type",
  "error",
  "error_code",
  "error_description",
] as const;

function callbackParamsFromQuery(query: string): URLSearchParams {
  return new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
}

function splitHashPathAndQuery(rawHash: string): { path: string; query: string } {
  const hash = rawHash.replace(/^#/, "");
  if (hash.includes("?")) {
    return {
      path: hash.slice(0, hash.indexOf("?")),
      query: hash.slice(hash.indexOf("?") + 1),
    };
  }
  if (hash.includes("=") && !hash.startsWith("/")) {
    return { path: "", query: hash };
  }
  return { path: hash, query: "" };
}

export function recoveryErrorFromLocation(search = "", hash = ""): string | null {
  const candidates = [search, hash.replace(/^#/, "")];
  for (const candidate of candidates) {
    const query = candidate.includes("?") ? candidate.slice(candidate.indexOf("?") + 1) : candidate;
    const params = callbackParamsFromQuery(query);
    if (params.get("error") || params.get("error_code") || params.get("error_description")) {
      return AUTH_USER_MESSAGES.recoveryInvalid;
    }
  }
  return null;
}

export function normalizeAdminAuthCallbackUrl(href: string): string {
  const url = new URL(href);
  const { path: hashPath, query: hashQuery } = splitHashPathAndQuery(url.hash);
  const hashParams = callbackParamsFromQuery(hashQuery);
  let moved = false;
  for (const key of AUTH_CALLBACK_PARAM_KEYS) {
    const value = hashParams.get(key);
    if (!value) continue;
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    hashParams.delete(key);
    moved = true;
  }
  if (!moved) return url.toString();
  const nextHashQuery = hashParams.toString();
  if (!nextHashQuery && (!hashPath || hashPath === "/")) {
    url.hash = "";
  } else {
    url.hash = nextHashQuery ? `${hashPath}?${nextHashQuery}` : hashPath;
  }
  return url.toString();
}

export function consumeAdminRecoveryTokenHashFromUrl(href: string): string {
  const url = new URL(normalizeAdminAuthCallbackUrl(href));
  url.searchParams.delete("token_hash");
  if (url.searchParams.get("type") !== "recovery") {
    url.searchParams.set("type", "recovery");
  }
  return url.toString();
}

export function applyAdminAuthCallbackLocation(): boolean {
  if (typeof window === "undefined") return false;
  const next = normalizeAdminAuthCallbackUrl(window.location.href);
  if (next === window.location.href) return false;
  window.history.replaceState(window.history.state, "", next);
  return true;
}

export function readAdminAuthCallbackParams(location?: { search?: string; hash?: string }) {
  const search = callbackParamsFromQuery(location?.search ?? "");
  const { query: hashQuery } = splitHashPathAndQuery(location?.hash ?? "");
  const hash = callbackParamsFromQuery(hashQuery);
  const get = (key: string) => search.get(key) ?? hash.get(key);
  return {
    code: get("code"),
    tokenHash: get("token_hash"),
    type: get("type"),
    error: get("error") ?? get("error_code") ?? get("error_description"),
  };
}

export const ADMIN_PASSWORD_RECOVERY_STORAGE_KEY = "lp-admin-password-recovery";

export function locationHasUnverifiedRecoveryTokenHash(
  location?: { search?: string; hash?: string },
): boolean {
  const callback = readAdminAuthCallbackParams(location);
  return callback.type === "recovery" && Boolean(callback.tokenHash);
}

export function shouldShowRecoveryContinue(
  location?: { search?: string; hash?: string },
): boolean {
  return locationHasUnverifiedRecoveryTokenHash(location);
}

export function shouldVerifyRecoveryTokenOnLoad(): boolean {
  return false;
}

export function canStartRecoveryTokenVerification(started: boolean, inFlight: boolean): boolean {
  return !started && !inFlight;
}

export function mapRecoveryVerifyError(error: AuthErrorLike): string {
  if (!error) return AUTH_USER_MESSAGES.recoveryInvalid;
  const name = normalisedAuthText(error.name);
  const message = normalisedAuthText(error.message);
  if (
    name.includes("retryable")
    || name.includes("fetcherror")
    || message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("load failed")
  ) {
    return AUTH_USER_MESSAGES.network;
  }
  return AUTH_USER_MESSAGES.recoveryInvalid;
}

export function decideRecoveryContinueAction(input: {
  started: boolean;
  inFlight: boolean;
  type: string | null | undefined;
  tokenHash: string | null | undefined;
}): { kind: "verify"; tokenHash: string } | { kind: "skip" } | { kind: "invalid" } {
  if (!canStartRecoveryTokenVerification(input.started, input.inFlight)) {
    return { kind: "skip" };
  }
  const tokenHash = String(input.tokenHash || "").trim();
  if (input.type !== "recovery" || !tokenHash) {
    return { kind: "invalid" };
  }
  return { kind: "verify", tokenHash };
}

export function locationHasRecoveryMarker(location?: { search?: string; hash?: string }): boolean {
  const callback = readAdminAuthCallbackParams(location);
  return callback.type === "recovery" && !callback.tokenHash;
}

export function shouldEnterPasswordRecovery(
  event: AuthBootstrapEvent,
  location?: { search?: string; hash?: string },
  pending = false,
): boolean {
  if (locationHasUnverifiedRecoveryTokenHash(location)) return false;
  if (event === "PASSWORD_RECOVERY") return true;
  if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return false;
  return pending || locationHasRecoveryMarker(location);
}

export function shouldBootstrapAdminData(
  event: AuthBootstrapEvent,
  location?: { search?: string; hash?: string },
  pending = false,
): boolean {
  if (locationHasUnverifiedRecoveryTokenHash(location)) return false;
  if (shouldEnterPasswordRecovery(event, location, pending)) return false;
  return event === "INITIAL_SESSION" || event === "SIGNED_IN";
}

export function stripRecoveryMarkerFromUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("token_hash");
  if (url.searchParams.get("type") === "recovery") {
    url.searchParams.delete("type");
  }
  const rawHash = url.hash.replace(/^#/, "");
  if (rawHash) {
    const query = rawHash.includes("?") ? rawHash.slice(rawHash.indexOf("?") + 1) : rawHash;
    const params = new URLSearchParams(query);
    if (params.has("type") || params.has("token_hash")) {
      params.delete("type");
      params.delete("token_hash");
      const next = params.toString();
      if (rawHash.includes("?")) {
        const path = rawHash.slice(0, rawHash.indexOf("?"));
        url.hash = next ? `${path}?${next}` : path;
      } else {
        url.hash = next;
      }
    }
  }
  return url.toString();
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
  if (status === "recovery-continue" || status === "recovery") return "recovery";
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
