import assert from "node:assert/strict";
import test from "node:test";
import {
  isBrowserSafeSupabaseKey,
  resolveAdminRuntimeConfig,
} from "../src/services/admin-runtime-config.ts";
import {
  AdminAuthError,
  AdminReadError,
  claimInitialPlatformAdmin,
  createSupabaseAdminReadService,
  loadAdminData,
  registerAdminAccount,
  registrationValidationMessage,
  type AdminSupabaseClient,
} from "../src/services/supabase-admin-service.ts";
import { sessionFromStaffContext } from "../src/stores/admin-session.ts";

const viewRows: Record<string, readonly Record<string, unknown>[]> = {
  current_staff_context: [{ teacher_id: "teacher-1", staff_reference: "STAFF-1", display_name: "Platform Admin", active: true, active_roles: ["platform_admin"] }],
  hubs: [{ hub_code: "hub-a", hub_name: "Hub A", description: "A reviewed hub", hub_version: "1.0.0", manifest_version: "1.0.0", core_version: "0.1.0", learner_api_version: "0.1.0", submission_contract_version: "0.1.0", platform_version: "0.1.0", subject: null, repository_url: "https://example.invalid/repo", deployment_url: null, curriculum_model: null, activity_types: ["quiz"], evidence_capabilities: ["question-level"], features: { progress: true }, compatibility: {}, status: "testing", active: true, manifest: {} }],
  hub_course_links: [{ hub_code: "hub-a", course_key: "course-a", course_title: "Course A", active: true, linked_at: "2026-08-11T00:00:00Z" }],
  platform_contracts: [{ contract_key: "admin-api", version: "0.2.0", status: "draft", compatibility: {}, contract_document: { boundary: "Read-only" } }],
  operational_health: [{ service_key: "database", status: "healthy", checked_at: "2026-08-11T00:00:00Z", valid_until: null, public_message: "Available" }],
  staff_roles: [{ staff_reference: "STAFF-1", display_name: "Platform Admin", role: "platform_admin", revoked_at: null }],
  learners: [{ student_number: "S-1", display_name: "Learner One", active: true, group_codes: ["G-1"], active_enrolment_count: 1 }],
  groups: [{ group_code: "G-1", group_name: "Group One", year_group: "Year 1", registration_open: true, active: true, academic_year: "2026-27", course_key: "course-a", course_title: "Course A", active_learner_count: 1 }],
  enrolments: [{ student_number: "S-1", group_code: "G-1", joined_on: "2026-09-01", left_on: null, status: "active" }],
  assignments: [{ group_code: "G-1", activity_key: "activity-a", activity_version: "1.0.0", opens_at: null, due_at: null, required: true, active: true }],
  attempts: [{ attempt_id: "attempt-1", student_number: "S-1", group_code: "G-1", activity_key: "activity-a", activity_version: "1.0.0", attempt_number: 1, status: "completed", score: 8, max_score: 10, marking_source: "server", evidence_level: "summary_only", received_at: "2026-08-11T00:00:00Z", completed_at: "2026-08-11T00:01:00Z" }],
  activity_performance: [{ group_code: "G-1", activity_key: "activity-a", activity_version: "1.0.0", completed_attempts: 1, learner_count: 1, average_score_percentage: 80, best_score_percentage: 80, first_completed_at: "2026-08-11T00:01:00Z", latest_completed_at: "2026-08-11T00:01:00Z" }],
  dashboard_summary: [{ registered_hubs: 1, active_hubs: 1, active_learners: 1, active_groups: 1, active_enrolments: 1, assignments: 1, recent_attempts: 1, completed_attempts: 1, average_score_percentage: 80, healthy_services: 1, service_count: 1, active_contracts: 0, contract_count: 1 }],
  audit_events: [{ event_key: "admin.read", actor_type: "staff", entity_type: "hub", entity_key: "hub-a", outcome: "succeeded", occurred_at: "2026-08-11T00:02:00Z" }],
};

function fakeClient(options: { failView?: string } = {}) {
  const selections: string[] = [];
  const schemas: string[] = [];
  const client = {
    schema(schema: string) {
      schemas.push(schema);
      return {
        from(view: string) {
          const query = {
            select(columns: string) {
              selections.push(`${view}:${columns}`);
              return query;
            },
            order() { return query; },
            then(resolve: (value: unknown) => unknown) {
              return Promise.resolve(resolve(
                options.failView === view
                  ? { data: null, error: { code: "503" } }
                  : { data: viewRows[view] ?? [], error: null },
              ));
            },
          };
          return query;
        },
      };
    },
  } as unknown as AdminSupabaseClient;
  return { client, selections, schemas };
}

test("runtime configuration defaults explicitly to demo and rejects secret keys", () => {
  assert.equal(resolveAdminRuntimeConfig({}).mode, "demo");
  assert.equal(resolveAdminRuntimeConfig({ NEXT_PUBLIC_ADMIN_DATA_MODE: "live" }).valid, false);
  assert.equal(isBrowserSafeSupabaseKey("sb_publishable_browser"), true);
  assert.equal(isBrowserSafeSupabaseKey("sb_secret_server"), false);
});

test("registration validates matching passwords before calling Supabase", () => {
  assert.equal(registrationValidationMessage("one-password", "different-password"), "Passwords must match.");
  assert.equal(registrationValidationMessage("matching-password", "matching-password"), null);
});

test("registration uses the existing public client and respects confirmation sessions", async () => {
  const calls: unknown[] = [];
  const registrationClient = {
    auth: {
      async signUp(credentials: unknown) {
        calls.push(credentials);
        return { data: { session: null }, error: null };
      },
    },
  } as unknown as AdminSupabaseClient;

  const pending = await registerAdminAccount(
    registrationClient,
    "admin@example.invalid",
    "test-password",
    "https://example.invalid/learning-platform-admin/",
  );

  assert.deepEqual(calls, [{
    email: "admin@example.invalid",
    password: "test-password",
    options: { emailRedirectTo: "https://example.invalid/learning-platform-admin/" },
  }]);
  assert.equal(pending.confirmationRequired, true);
  assert.equal(pending.sessionAvailable, false);

  const immediateClient = {
    auth: {
      async signUp() {
        return { data: { session: { access_token: "public-session" } }, error: null };
      },
    },
  } as unknown as AdminSupabaseClient;
  const immediate = await registerAdminAccount(
    immediateClient,
    "admin@example.invalid",
    "test-password",
    "https://example.invalid/learning-platform-admin/",
  );
  assert.equal(immediate.confirmationRequired, false);
  assert.equal(immediate.sessionAvailable, true);
});

test("registration errors are normalised without exposing provider details", async () => {
  const client = {
    auth: {
      async signUp() {
        return {
          data: { session: null },
          error: { message: "Email already registered: private provider detail" },
        };
      },
    },
  } as unknown as AdminSupabaseClient;

  await assert.rejects(
    () => registerAdminAccount(client, "admin@example.invalid", "password", "https://example.invalid/"),
    (error: unknown) => error instanceof AdminAuthError
      && error.code === "registration-failed"
      && !error.message.includes("already registered"),
  );
});

test("initial administrator claim sends only the one-time token through admin_api", async () => {
  const calls: unknown[] = [];
  const client = {
    schema(schema: string) {
      calls.push({ schema });
      return {
        async rpc(name: string, parameters: unknown) {
          calls.push({ name, parameters });
          return { data: [{ idempotent: false }], error: null };
        },
      };
    },
  } as unknown as AdminSupabaseClient;

  await claimInitialPlatformAdmin(client, "one-time-token");
  assert.deepEqual(calls, [
    { schema: "admin_api" },
    {
      name: "claim_initial_platform_admin",
      parameters: { p_bootstrap_token: "one-time-token" },
    },
  ]);
  assert.deepEqual(
    Object.keys((calls[1] as { parameters: Record<string, unknown> }).parameters),
    ["p_bootstrap_token"],
  );
});

test("learner and non-admin staff contexts are denied while platform admin is authorised", () => {
  assert.equal(sessionFromStaffContext(null).state, "access-denied");
  assert.equal(sessionFromStaffContext({ teacherId: "t", staffReference: "T", displayName: "Teacher", active: true, activeRoles: [] }).state, "access-denied");
  const admin = sessionFromStaffContext({ teacherId: "a", staffReference: "A", displayName: "Admin", active: true, activeRoles: ["platform_admin"] });
  assert.equal(admin.state, "authenticated");
  assert.deepEqual(admin.grantedActions, ["*"]);
});

test("live service reads every MVP surface through admin_api and maps safe rows", async () => {
  const fake = fakeClient();
  const service = createSupabaseAdminReadService(fake.client);
  const context = await service.getCurrentStaffContext();
  const data = await loadAdminData(service);
  assert.equal(context?.displayName, "Platform Admin");
  assert.equal(data.hubs[0].hubCode, "hub-a");
  assert.equal(data.learners[0].studentNumber, "S-1");
  assert.equal(data.groups[0].activeLearnerCount, 1);
  assert.equal(data.enrolments[0].groupCode, "G-1");
  assert.equal(data.assignments[0].activityKey, "activity-a");
  assert.equal(data.attempts[0].score, 8);
  assert.equal(data.activityPerformance[0].averageScorePercentage, 80);
  assert.equal(data.dashboardSummary.recentAttempts, 1);
  assert.ok(fake.schemas.every((schema) => schema === "admin_api"));
  const selected = fake.selections.join("\n");
  assert.doesNotMatch(selected, /response_payload|diagnostics|contact_email/);
});

test("a live read failure becomes unavailable and never invokes demo fallback", async () => {
  const service = createSupabaseAdminReadService(fakeClient({ failView: "hubs" }).client);
  await assert.rejects(
    () => service.listHubs(),
    (error: unknown) => error instanceof AdminReadError && error.code === "unavailable",
  );
});
