import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  requestAdminPasswordReset,
  signInAdminWithPassword,
  updateAdminPassword,
  verifyAdminRecoveryTokenHash,
  type AdminSupabaseClient,
} from "../src/services/supabase-admin-service.ts";
import {
  AUTH_USER_MESSAGES,
  adminAuthPhase,
  consumeAdminRecoveryTokenHashFromUrl,
  decideRecoveryContinueAction,
  mapPasswordUpdateError,
  mapRecoveryVerifyError,
  mapSignInError,
  normalizeAdminAuthCallbackUrl,
  readAdminAuthCallbackParams,
  recoveryErrorFromLocation,
  resolveAdminAuthRedirectUrl,
  shouldBootstrapAdminData,
  shouldClearAdminData,
  shouldEnterPasswordRecovery,
  shouldShowRecoveryContinue,
  shouldVerifyRecoveryTokenOnLoad,
  stripRecoveryMarkerFromUrl,
} from "../src/stores/admin-portal-auth.ts";
import { sessionFromStaffContext } from "../src/stores/admin-session.ts";

const TEST_PASSWORD = "test-password-not-production";

function authClient(handlers: {
  signInWithPassword?: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  resetPasswordForEmail?: (email: string, options: { redirectTo: string }) => Promise<{ error: unknown }>;
  verifyOtp?: (credentials: { token_hash: string; type: string }) => Promise<{ error: unknown }>;
  updateUser?: (attributes: { password: string }) => Promise<{ error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
}) {
  return {
    auth: {
      signInWithPassword: handlers.signInWithPassword,
      resetPasswordForEmail: handlers.resetPasswordForEmail,
      verifyOtp: handlers.verifyOtp,
      updateUser: handlers.updateUser,
      signOut: handlers.signOut,
    },
  } as unknown as AdminSupabaseClient;
}

test("valid administrator email and password authentication succeeds", async () => {
  const calls: unknown[] = [];
  const client = authClient({
    async signInWithPassword(credentials) {
      calls.push(credentials);
      return { error: null };
    },
  });
  await signInAdminWithPassword(client, " admin@example.invalid ", TEST_PASSWORD);
  assert.deepEqual(calls, [{ email: "admin@example.invalid", password: TEST_PASSWORD }]);
});

test("invalid password and unknown user fail without exposing provider details", async () => {
  const invalid = authClient({
    async signInWithPassword() {
      return { error: { code: "invalid_credentials", message: "Invalid login credentials: private provider detail" } };
    },
  });
  await assert.rejects(
    () => signInAdminWithPassword(invalid, "admin@example.invalid", "wrong-password"),
    (error: unknown) => {
      const message = error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message)
        : "";
      return message.includes("Invalid login credentials") && !message.includes(TEST_PASSWORD);
    },
  );

  const unknown = authClient({
    async signInWithPassword() {
      return { error: { message: "User not found" } };
    },
  });
  await assert.rejects(() => signInAdminWithPassword(unknown, "missing@example.invalid", TEST_PASSWORD));
  assert.equal(
    mapSignInError({ code: "invalid_credentials", message: "Invalid login credentials" }),
    AUTH_USER_MESSAGES.invalidCredentials,
  );
  assert.equal(
    mapSignInError({ message: "User not found" }),
    AUTH_USER_MESSAGES.invalidCredentials,
  );
  assert.equal(
    mapSignInError({ name: "AuthRetryableFetchError", message: "Failed to fetch" }),
    AUTH_USER_MESSAGES.network,
  );
  assert.doesNotMatch(mapSignInError({ message: "Invalid login credentials: secret" }), /secret|supabase|jwt/i);
});

test("logout clears frontend admin access", () => {
  assert.equal(shouldClearAdminData("SIGNED_OUT"), true);
  assert.equal(shouldBootstrapAdminData("SIGNED_OUT"), false);
  assert.equal(sessionFromStaffContext(null).state, "access-denied");
  assert.equal(sessionFromStaffContext(null).grantedActions.length, 0);
});

test("browser-supplied role flags and localStorage cannot grant admin access", () => {
  const fabricated = sessionFromStaffContext({
    teacherId: "teacher-1",
    staffReference: "STAFF-1",
    displayName: "Claimed Admin",
    active: true,
    activeRoles: [],
    isAdmin: true,
    role: "platform_admin",
    grantedActions: ["*"],
  } as never);
  assert.equal(fabricated.state, "access-denied");
  assert.deepEqual(fabricated.grantedActions, []);

  const teacher = sessionFromStaffContext({
    teacherId: "teacher-2",
    staffReference: "STAFF-2",
    displayName: "Teacher",
    active: true,
    activeRoles: ["support"],
  });
  assert.equal(teacher.state, "access-denied");

  const admin = sessionFromStaffContext({
    teacherId: "teacher-3",
    staffReference: "STAFF-3",
    displayName: "Admin",
    active: true,
    activeRoles: ["platform_admin"],
  });
  assert.equal(admin.state, "authenticated");
});

test("password reset uses the GitHub Pages callback URL and recovery session", async () => {
  const calls: unknown[] = [];
  const client = authClient({
    async resetPasswordForEmail(email, options) {
      calls.push({ email, options });
      return { error: null };
    },
    async updateUser(attributes) {
      calls.push({ passwordLength: attributes.password.length });
      return { error: null };
    },
  });

  await requestAdminPasswordReset(
    client,
    "admin@example.invalid",
    "https://acerosa.github.io/learning-platform-admin/",
  );
  await updateAdminPassword(client, TEST_PASSWORD);
  assert.deepEqual(calls[0], {
    email: "admin@example.invalid",
    options: { redirectTo: "https://acerosa.github.io/learning-platform-admin/" },
  });
  assert.deepEqual(calls[1], { passwordLength: TEST_PASSWORD.length });
});

test("invalid or expired recovery fails safely", async () => {
  assert.equal(
    recoveryErrorFromLocation("?error=access_denied&error_code=otp_expired", ""),
    AUTH_USER_MESSAGES.recoveryInvalid,
  );
  assert.equal(shouldEnterPasswordRecovery("PASSWORD_RECOVERY"), true);
  assert.equal(shouldBootstrapAdminData("PASSWORD_RECOVERY"), false);
  assert.equal(
    shouldEnterPasswordRecovery("SIGNED_IN", { search: "?code=example", hash: "#type=recovery" }),
    true,
  );
  assert.equal(
    shouldEnterPasswordRecovery("SIGNED_IN", { search: "?type=recovery&code=pkce-code" }),
    true,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", { search: "?type=recovery&code=pkce-code" }),
    false,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", { hash: "#type=recovery" }),
    false,
  );
  assert.equal(
    shouldEnterPasswordRecovery("SIGNED_IN", { search: "" }, true),
    true,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", { search: "" }, true),
    false,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", { search: "" }, false),
    true,
  );
  assert.equal(
    stripRecoveryMarkerFromUrl("https://acerosa.github.io/learning-platform-admin/?type=recovery"),
    "https://acerosa.github.io/learning-platform-admin/",
  );
  assert.equal(
    stripRecoveryMarkerFromUrl("https://acerosa.github.io/learning-platform-admin/?token_hash=recovery-hash&type=recovery"),
    "https://acerosa.github.io/learning-platform-admin/",
  );
  assert.equal(
    stripRecoveryMarkerFromUrl("https://acerosa.github.io/learning-platform-admin/?type=recovery&code=pkce-code"),
    "https://acerosa.github.io/learning-platform-admin/?code=pkce-code",
  );
  assert.equal(
    mapPasswordUpdateError({ message: "Auth session missing" }),
    AUTH_USER_MESSAGES.recoveryInvalid,
  );

  const expired = authClient({
    async updateUser() {
      return { error: { message: "Error: session expired for recovery" } };
    },
  });
  await assert.rejects(() => updateAdminPassword(expired, TEST_PASSWORD));
});

test("GitHub Pages recovery callbacks keep PKCE and token hash on the search string", () => {
  const pagesRoot = "https://acerosa.github.io/learning-platform-admin/";
  assert.equal(
    normalizeAdminAuthCallbackUrl(`${pagesRoot}?code=pkce-code&type=recovery`),
    `${pagesRoot}?code=pkce-code&type=recovery`,
  );
  assert.equal(
    normalizeAdminAuthCallbackUrl(`${pagesRoot}#/?code=pkce-code&type=recovery`),
    `${pagesRoot}?code=pkce-code&type=recovery`,
  );
  assert.equal(
    normalizeAdminAuthCallbackUrl(`${pagesRoot}#/dashboard?code=pkce-code&type=recovery`),
    `${pagesRoot}?code=pkce-code&type=recovery#/dashboard`,
  );
  assert.equal(
    readAdminAuthCallbackParams({ search: "?token_hash=recovery-hash&type=recovery" }).type,
    "recovery",
  );
  assert.equal(
    shouldEnterPasswordRecovery("INITIAL_SESSION", {
      search: "?token_hash=recovery-hash&type=recovery",
    }),
    false,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", {
      search: "?token_hash=recovery-hash&type=recovery",
    }),
    false,
  );
  assert.equal(
    shouldEnterPasswordRecovery("INITIAL_SESSION", {
      search: "?token_hash=recovery-hash&type=recovery",
    }, true),
    false,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", { search: "?code=magic-link-code" }),
    true,
  );
  assert.equal(
    shouldEnterPasswordRecovery("SIGNED_IN", { search: "?code=magic-link-code" }),
    false,
  );
  assert.equal(
    recoveryErrorFromLocation(
      "?type=recovery&error=access_denied&error_code=otp_expired",
      "",
    ),
    AUTH_USER_MESSAGES.recoveryInvalid,
  );
  assert.equal(
    consumeAdminRecoveryTokenHashFromUrl(
      "https://acerosa.github.io/learning-platform-admin/?token_hash=recovery-hash&type=recovery",
    ),
    "https://acerosa.github.io/learning-platform-admin/?type=recovery",
  );
  assert.equal(
    shouldEnterPasswordRecovery("INITIAL_SESSION", { search: "" }),
    false,
  );
  assert.equal(
    shouldEnterPasswordRecovery("INITIAL_SESSION", { search: "?token_hash=recovery-hash" }),
    false,
  );
  assert.equal(
    shouldEnterPasswordRecovery("INITIAL_SESSION", { search: "?type=recovery" }),
    true,
  );
  assert.equal(
    shouldEnterPasswordRecovery("INITIAL_SESSION", { search: "?type=recovery" }, true),
    true,
  );
  assert.equal(
    shouldBootstrapAdminData("SIGNED_IN", { search: "?code=pkce-code&type=recovery" }),
    false,
  );
});

test("token_hash recovery is verified by Supabase, not the browser", async () => {
  const calls: unknown[] = [];
  const valid = authClient({
    async verifyOtp(credentials) {
      calls.push(credentials);
      return { error: null };
    },
  });
  await verifyAdminRecoveryTokenHash(valid, " recovery-hash ");
  assert.deepEqual(calls, [{ token_hash: "recovery-hash", type: "recovery" }]);

  const invalid = authClient({
    async verifyOtp() {
      return { error: { code: "otp_expired", message: "Token has expired or is invalid" } };
    },
  });
  await assert.rejects(() => verifyAdminRecoveryTokenHash(invalid, "invalid-hash"));

  const expired = authClient({
    async verifyOtp() {
      return { error: { code: "otp_expired", message: "Token has expired or is invalid" } };
    },
  });
  await assert.rejects(() => verifyAdminRecoveryTokenHash(expired, "expired-hash"));
});

test("recovery URLs wait for Continue password reset before calling verifyOtp", async () => {
  const recoveryLocation = { search: "?token_hash=recovery-hash&type=recovery" };
  const magicLinkLocation = { search: "?code=magic-link-code" };
  const firstLoad = shouldShowRecoveryContinue(recoveryLocation);
  const reloadBeforeContinue = shouldShowRecoveryContinue(recoveryLocation);

  assert.equal(shouldVerifyRecoveryTokenOnLoad(), false);
  assert.equal(firstLoad, true);
  assert.equal(reloadBeforeContinue, true);
  assert.equal(shouldEnterPasswordRecovery("INITIAL_SESSION", recoveryLocation), false);
  assert.equal(shouldBootstrapAdminData("INITIAL_SESSION", recoveryLocation), false);
  assert.equal(shouldBootstrapAdminData("SIGNED_IN", recoveryLocation), false);
  assert.deepEqual(
    decideRecoveryContinueAction({
      started: false,
      inFlight: false,
      type: "recovery",
      tokenHash: "recovery-hash",
    }),
    { kind: "verify", tokenHash: "recovery-hash" },
  );
  assert.deepEqual(
    decideRecoveryContinueAction({
      started: true,
      inFlight: false,
      type: "recovery",
      tokenHash: "recovery-hash",
    }),
    { kind: "skip" },
  );
  assert.deepEqual(
    decideRecoveryContinueAction({
      started: false,
      inFlight: true,
      type: "recovery",
      tokenHash: "recovery-hash",
    }),
    { kind: "skip" },
  );
  assert.deepEqual(
    decideRecoveryContinueAction({
      started: false,
      inFlight: false,
      type: "recovery",
      tokenHash: null,
    }),
    { kind: "invalid" },
  );

  const verifyCalls: unknown[] = [];
  const valid = authClient({
    async verifyOtp(credentials) {
      verifyCalls.push(credentials);
      return { error: null };
    },
  });
  const click = decideRecoveryContinueAction({
    started: false,
    inFlight: false,
    type: "recovery",
    tokenHash: "recovery-hash",
  });
  assert.equal(click.kind, "verify");
  if (click.kind === "verify") {
    await verifyAdminRecoveryTokenHash(valid, click.tokenHash);
  }
  const repeatClick = decideRecoveryContinueAction({
    started: true,
    inFlight: false,
    type: "recovery",
    tokenHash: "recovery-hash",
  });
  assert.equal(repeatClick.kind, "skip");
  assert.deepEqual(verifyCalls, [{ token_hash: "recovery-hash", type: "recovery" }]);
  assert.equal(
    shouldEnterPasswordRecovery("PASSWORD_RECOVERY", { search: "?type=recovery" }, true),
    true,
  );
  assert.equal(
    consumeAdminRecoveryTokenHashFromUrl(
      "https://acerosa.github.io/learning-platform-admin/?token_hash=recovery-hash&type=recovery",
    ),
    "https://acerosa.github.io/learning-platform-admin/?type=recovery",
  );
  assert.equal(
    stripRecoveryMarkerFromUrl("https://acerosa.github.io/learning-platform-admin/?type=recovery"),
    "https://acerosa.github.io/learning-platform-admin/",
  );

  assert.equal(
    mapRecoveryVerifyError({ code: "otp_expired", message: "Token has expired or is invalid" }),
    AUTH_USER_MESSAGES.recoveryInvalid,
  );
  assert.equal(
    mapRecoveryVerifyError({ name: "AuthRetryableFetchError", message: "Failed to fetch" }),
    AUTH_USER_MESSAGES.network,
  );
  assert.equal(shouldBootstrapAdminData("SIGNED_IN", magicLinkLocation), true);
  assert.equal(shouldEnterPasswordRecovery("SIGNED_IN", magicLinkLocation), false);
});

test("auth redirect URLs keep the GitHub Pages repository path", () => {
  assert.equal(
    resolveAdminAuthRedirectUrl({
      origin: "https://acerosa.github.io",
      pathname: "/learning-platform-admin/",
      usesHashRouting: true,
    }),
    "https://acerosa.github.io/learning-platform-admin/",
  );
  assert.equal(
    resolveAdminAuthRedirectUrl({
      origin: "https://acerosa.github.io",
      pathname: "/learning-platform-admin/",
      usesHashRouting: true,
      recovery: true,
    }),
    "https://acerosa.github.io/learning-platform-admin/?type=recovery",
  );
  assert.equal(
    resolveAdminAuthRedirectUrl({
      origin: "http://localhost:3000",
      pathname: "/hubs",
      usesHashRouting: false,
    }),
    "http://localhost:3000/",
  );
});

test("portal auth phases distinguish unauthenticated, authenticating, authorising, authorised and forbidden", () => {
  assert.equal(adminAuthPhase("signed-out", false), "unauthenticated");
  assert.equal(adminAuthPhase("authenticating", false), "authenticating");
  assert.equal(adminAuthPhase("loading", false), "authorising");
  assert.equal(adminAuthPhase("ready", true), "authorised");
  assert.equal(adminAuthPhase("access-denied", false), "forbidden");
  assert.equal(adminAuthPhase("recovery-continue", false), "recovery");
  assert.equal(adminAuthPhase("recovery", false), "recovery");
  assert.equal(adminAuthPhase("error", false), "error");
});

test("admin source never treats getSession, query params or localStorage as admin authority", async () => {
  const root = new URL("../", import.meta.url);
  const [portal, session, accessGate, service, portalPage] = await Promise.all([
    readFile(new URL("src/stores/admin-portal.tsx", root), "utf8"),
    readFile(new URL("src/stores/admin-session.ts", root), "utf8"),
    readFile(new URL("src/components/admin-access-gate.tsx", root), "utf8"),
    readFile(new URL("src/services/supabase-admin-service.ts", root), "utf8"),
    readFile(new URL("src/views/admin-portal-page.tsx", root), "utf8"),
  ]);
  assert.match(portal, /getCurrentStaffContext/);
  assert.match(portal, /sessionFromStaffContext/);
  assert.doesNotMatch(portal, /searchParams|localStorage\.getItem/);
  assert.doesNotMatch(session, /localStorage|searchParams|email\s*===/);
  assert.match(accessGate, /Forgot password/);
  assert.match(accessGate, /Email me a sign-in link/);
  assert.match(accessGate, /Reset your Admin Portal password/);
  assert.match(accessGate, /Continue password reset/);
  assert.match(accessGate, /Choose a new password/);
  assert.doesNotMatch(accessGate, /token_hash|tokenHash|\{\{ \.TokenHash \}\}/);
  assert.doesNotMatch(accessGate, /One-time setup code|Create account/);
  assert.match(portal, /applyAdminAuthCallbackLocation/);
  assert.match(portal, /verifyAdminRecoveryTokenHash/);
  assert.match(portal, /let recoveryTokenHashVerifyStarted = false/);
  assert.match(portal, /recoveryTokenHashVerifyCancelled/);
  assert.match(portal, /recoveryTokenHashVerifyInFlight/);
  assert.match(portal, /const continueRecovery = useCallback/);
  assert.match(portal, /status: "recovery-continue"/);
  assert.match(portalPage, /recovery-continue/);
  assert.match(portalPage, /AdminRecoveryContinue/);
  assert.match(portalPage, /portal\.continueRecovery/);
  assert.doesNotMatch(portal, /void verifyAdminRecoveryTokenHash/);
  const authEffect = portal.slice(
    portal.indexOf("useEffect(() => {"),
    portal.indexOf("const signIn"),
  );
  assert.doesNotMatch(authEffect, /verifyAdminRecoveryTokenHash|verifyOtp/);
  const continueRecovery = portal.slice(
    portal.indexOf("const continueRecovery"),
    portal.indexOf("const updatePassword"),
  );
  const verifyCall = portal.indexOf("verifyAdminRecoveryTokenHash(");
  assert.ok(verifyCall > portal.indexOf("const continueRecovery"));
  assert.equal(portal.indexOf("verifyAdminRecoveryTokenHash(", verifyCall + 1), -1);
  assert.match(continueRecovery, /decideRecoveryContinueAction/);
  assert.match(continueRecovery, /await verifyAdminRecoveryTokenHash/);
  assert.match(
    continueRecovery,
    /await verifyAdminRecoveryTokenHash[\s\S]*consumeRecoveryTokenHashFromWindow/,
  );
  assert.doesNotMatch(
    continueRecovery,
    /consumeRecoveryTokenHashFromWindow[\s\S]*await verifyAdminRecoveryTokenHash/,
  );
  assert.match(continueRecovery, /enterPasswordRecovery\(null\)/);
  assert.match(
    portal,
    /if \(recoveryTokenHashVerifyInFlight && !recoveryTokenHashVerifyCancelled\) \{\s*return;/,
  );
  assert.match(portal, /redirectUrl\(\{ recovery: true \}\)/);
  assert.match(portal, /emailRedirectTo: redirectUrl\(\)/);
  assert.match(portal, /signInWithOtp/);
  assert.match(service, /verifyOtp\(\{\s*token_hash:[\s\S]*type: "recovery"/);
  assert.match(service, /resetPasswordForEmail/);
  assert.match(service, /signInWithPassword/);
  assert.match(portal, /bootstrapGeneration/);
  assert.match(portal, /status: "recovery"/);
  assert.match(portal, /stripRecoveryMarkerFromUrl/);
  assert.match(portal, /sessionStorage/);
  assert.match(
    portal.slice(portal.indexOf("const exitPasswordRecovery"), portal.indexOf("const loadModuleData")),
    /clearRecoveryMarkerFromLocation/,
  );
  assert.doesNotMatch(
    portal.slice(portal.indexOf("const enterPasswordRecovery"), portal.indexOf("const exitPasswordRecovery")),
    /clearRecoveryMarkerFromLocation/,
  );
  assert.match(
    portal.slice(portal.indexOf("const updatePassword"), portal.indexOf("const registerHub")),
    /exitPasswordRecovery\(\)/,
  );
  assert.match(
    portal.slice(portal.indexOf("const updatePassword"), portal.indexOf("const registerHub")),
    /bootstrapSession/,
  );
  assert.match(
    portal.slice(portal.indexOf("const signOut"), portal.indexOf("const data = useMemo")),
    /recoveryTokenHashVerifyCancelled = true/,
  );
  assert.match(
    portal.slice(portal.indexOf("const signOut"), portal.indexOf("const data = useMemo")),
    /exitPasswordRecovery\(\)/,
  );
  assert.match(service, /current_staff_context/);
  assert.doesNotMatch(`${portal}\n${session}\n${accessGate}\n${service}`, /service_role|sb_secret_/i);
  assert.doesNotMatch(
    `${portal}\n${service}`,
    /console\.(?:log|debug|info|warn)\([\s\S]*(?:password|token_hash|otp|jwt|service.role|sb_secret_)/i,
  );
});
