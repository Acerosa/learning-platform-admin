import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_API_RPCS, ADMIN_MUTATION_STATUS } from "../src/api/admin-api.ts";
import {
  formFromManifest,
  manifestFromForm,
  parseHubManifestJson,
  validateHubManifest,
} from "../src/content/hub-manifest.ts";
import { registerDemoHub, validateHubRegistration } from "../src/content/hub-registration.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";
import {
  AdminHubRegistrationError,
  registerHub,
  type AdminSupabaseClient,
} from "../src/services/supabase-admin-service.ts";

const SYNTHETIC_MANIFEST = Object.freeze({
  manifestVersion: "1.0.0",
  hubId: "synthetic-admin-registered-hub",
  name: "Synthetic Admin Registered Hub",
  description: "Synthetic hub used to prove administrative registration.",
  version: "0.1.0",
  repositoryUrl: "https://example.invalid/synthetic-admin-registered-hub",
  deploymentUrl: "https://synthetic-admin-registered-hub.example.invalid",
  courses: ["ocr-level-3-it"],
  compatibility: {
    required: {
      coreVersion: "0.1.0",
      learnerApiContractVersion: "0.1.0",
      submissionContractVersion: "0.1.0",
    },
    testedCombinations: [{
      coreVersion: "0.1.0",
      learnerApiContractVersion: "0.1.0",
      submissionContractVersion: "0.1.0",
    }],
  },
  capabilities: {
    evidence: ["question-level"],
    activities: ["classification", "diagnostic"],
  },
  featureFlags: {
    authentication: true,
    onboarding: true,
    progress: true,
  },
});

test("form fields round-trip through the hub manifest contract", () => {
  const form = formFromManifest(SYNTHETIC_MANIFEST, "testing", true);
  const manifest = manifestFromForm(form);
  assert.equal(manifest.hubId, "synthetic-admin-registered-hub");
  assert.deepEqual(manifest.courses, ["ocr-level-3-it"]);
  assert.equal(manifest.compatibility.required.coreVersion, "0.1.0");
  assert.equal(form.status, "testing");
  assert.equal(form.active, true);
});

test("manifest import rejects invalid JSON and unknown fields", () => {
  const invalid = parseHubManifestJson("{not json");
  assert.equal(invalid.issues[0]?.code, "INVALID_JSON");
  const extra = validateHubManifest({ ...SYNTHETIC_MANIFEST, extraField: true });
  assert.equal(extra.valid, false);
  assert.ok(extra.issues.some((issue) => issue.code === "SCHEMA_UNKNOWN_FIELD"));
});

test("registration validation reports diagnostics for duplicates and unsupported versions", () => {
  const duplicate = validateHubRegistration(
    { ...SYNTHETIC_MANIFEST, hubId: "unit-3-cyber-security" },
    "testing",
    true,
    DEMO_ADMIN_DATA,
  );
  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.issues.some((issue) => issue.code === "DUPLICATE_HUB_ID"));

  const unsupported = validateHubRegistration(
    {
      ...SYNTHETIC_MANIFEST,
      compatibility: {
        required: {
          coreVersion: "9.9.9",
          learnerApiContractVersion: "0.1.0",
          submissionContractVersion: "0.1.0",
        },
        testedCombinations: [{
          coreVersion: "9.9.9",
          learnerApiContractVersion: "0.1.0",
          submissionContractVersion: "0.1.0",
        }],
      },
    },
    "testing",
    true,
    DEMO_ADMIN_DATA,
  );
  assert.ok(unsupported.issues.some((issue) => issue.code === "UNSUPPORTED_PLATFORM_VERSION"));
});

test("demo registration updates the registry, dashboard count and audit without a live RPC", () => {
  const registered = registerDemoHub(DEMO_ADMIN_DATA, {
    manifest: SYNTHETIC_MANIFEST,
    status: "testing",
    active: true,
  });
  assert.equal(registered.result.hub.hubCode, "synthetic-admin-registered-hub");
  assert.equal(registered.snapshot.hubs.length, DEMO_ADMIN_DATA.hubs.length + 1);
  assert.equal(registered.snapshot.dashboardSummary.registeredHubs, DEMO_ADMIN_DATA.dashboardSummary.registeredHubs + 1);
  assert.equal(registered.snapshot.dashboardSummary.activeHubs, DEMO_ADMIN_DATA.dashboardSummary.activeHubs + 1);
  assert.ok(registered.snapshot.hubCourseLinks.some((link) => (
    link.hubCode === "synthetic-admin-registered-hub" && link.courseKey === "ocr-level-3-it"
  )));
  assert.equal(registered.snapshot.auditEvents[0]?.eventKey, "hub.registration.registered");
  assert.equal(DEMO_ADMIN_DATA.hubs.length, 2);
});

test("demo duplicate registration is rejected without mutating the original snapshot", () => {
  const first = registerDemoHub(DEMO_ADMIN_DATA, {
    manifest: SYNTHETIC_MANIFEST,
    status: "testing",
    active: false,
  });
  assert.throws(
    () => registerDemoHub(first.snapshot, {
      manifest: SYNTHETIC_MANIFEST,
      status: "testing",
      active: false,
    }),
    /DUPLICATE_HUB_ID|HUB_MANIFEST_INVALID/,
  );
  assert.equal(first.snapshot.hubs.filter((hub) => hub.hubCode === "synthetic-admin-registered-hub").length, 1);
});

test("live registerHub sends only the documented admin_api arguments", async () => {
  const rpcs: unknown[] = [];
  const client = {
    schema(schema: string) {
      return {
        async rpc(name: string, parameters: unknown) {
          rpcs.push({ schema, name, parameters });
          return {
            data: [{
              hub_code: SYNTHETIC_MANIFEST.hubId,
              hub_name: SYNTHETIC_MANIFEST.name,
              description: SYNTHETIC_MANIFEST.description,
              hub_version: SYNTHETIC_MANIFEST.version,
              manifest_version: SYNTHETIC_MANIFEST.manifestVersion,
              core_version: "0.1.0",
              learner_api_version: "0.1.0",
              submission_contract_version: "0.1.0",
              platform_version: "0.1.0",
              repository_url: SYNTHETIC_MANIFEST.repositoryUrl,
              deployment_url: SYNTHETIC_MANIFEST.deploymentUrl,
              activity_types: SYNTHETIC_MANIFEST.capabilities.activities,
              evidence_capabilities: SYNTHETIC_MANIFEST.capabilities.evidence,
              features: SYNTHETIC_MANIFEST.featureFlags,
              compatibility: SYNTHETIC_MANIFEST.compatibility,
              status: "testing",
              active: true,
              course_keys: SYNTHETIC_MANIFEST.courses,
            }],
            error: null,
          };
        },
      };
    },
  } as unknown as AdminSupabaseClient;

  const result = await registerHub(client, {
    manifest: SYNTHETIC_MANIFEST,
    status: "testing",
    active: true,
  });
  assert.equal(result.hubCode, "synthetic-admin-registered-hub");
  assert.deepEqual(rpcs, [{
    schema: "admin_api",
    name: "register_hub",
    parameters: {
      p_manifest: SYNTHETIC_MANIFEST,
      p_status: "testing",
      p_active: true,
    },
  }]);
  assert.equal(ADMIN_API_RPCS.registerHub, "admin_api.register_hub");
});

test("live registerHub maps duplicate errors without exposing SQL", async () => {
  const client = {
    schema() {
      return {
        async rpc() {
          return { data: null, error: { message: "HUB_DUPLICATE_CODE" } };
        },
      };
    },
  } as unknown as AdminSupabaseClient;
  await assert.rejects(
    () => registerHub(client, { manifest: SYNTHETIC_MANIFEST, status: "testing", active: true }),
    (error: unknown) => error instanceof AdminHubRegistrationError
      && error.code === "HUB_DUPLICATE_CODE"
      && !error.message.includes("sql"),
  );
});

test("remaining mutation controls stay pending after hub registration is enabled", () => {
  assert.match(ADMIN_MUTATION_STATUS.reason, /register_hub/);
  assert.match(ADMIN_MUTATION_STATUS.reason, /remain unspecified/);
  assert.equal(ADMIN_MUTATION_STATUS.status, "pending-backend-contract");
});
