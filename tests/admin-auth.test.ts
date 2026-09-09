import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  requestAdminPasswordReset,
  signInAdminWithPassword,
  updateAdminPassword,
  type AdminSupabaseClient,
} from "../src/services/supabase-admin-service.ts";
import {
  AUTH_USER_MESSAGES,
  adminAuthPhase,
  mapPasswordUpdateError,
  mapSignInError,
  recoveryErrorFromLocation,
  resolveAdminAuthRedirectUrl,
  shouldBootstrapAdminData,
  shouldClearAdminData,
  shouldEnterPasswordRecovery,
} from "../src/stores/admin-portal-auth.ts";
import { sessionFromStaffContext } from "../src/stores/admin-session.ts";

const TEST_PASSWORD = "test-password-not-production";

function authClient(handlers: {
  signInWithPassword?: (credentials: { email: string; password: string }) => Promise<{ error: unknown }>;
  resetPasswordForEmail?: (email: string, options: { redirectTo: string }) => Promise<{ error: unknown }>;
  updateUser?: (attributes: { password: string }) => Promise<{ error: unknown }>;
  signOut?: () => Promise<{ error: unknown }>;
}) {
  return {
    auth: {
      signInWithPassword: handlers.signInWithPassword,
      resetPasswordForEmail: handlers.resetPasswordForEmail,
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
    shouldBootstrapAdminData("SIGNED_IN", { hash: "#type=recovery" }),
    false,
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
  assert.equal(adminAuthPhase("recovery", false), "recovery");
  assert.equal(adminAuthPhase("error", false), "error");
});

test("admin source never treats getSession, query params or localStorage as admin authority", async () => {
  const root = new URL("../", import.meta.url);
  const [portal, session, accessGate, service] = await Promise.all([
    readFile(new URL("src/stores/admin-portal.tsx", root), "utf8"),
    readFile(new URL("src/stores/admin-session.ts", root), "utf8"),
    readFile(new URL("src/components/admin-access-gate.tsx", root), "utf8"),
    readFile(new URL("src/services/supabase-admin-service.ts", root), "utf8"),
  ]);
  assert.match(portal, /getCurrentStaffContext/);
  assert.match(portal, /sessionFromStaffContext/);
  assert.doesNotMatch(portal, /searchParams|localStorage\.getItem/);
  assert.doesNotMatch(session, /localStorage|searchParams|email\s*===/);
  assert.match(accessGate, /Forgot password/);
  assert.match(accessGate, /Email me a sign-in link/);
  assert.doesNotMatch(accessGate, /One-time setup code|Create account/);
  assert.match(service, /current_staff_context/);
  assert.doesNotMatch(`${portal}\n${session}\n${accessGate}\n${service}`, /service_role|sb_secret_/i);
  assert.doesNotMatch(portal, /console\.log\((?:.*password|.*session|.*jwt)/i);
});
