import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_API_RPCS, ADMIN_MUTATION_STATUS } from "../src/api/admin-api.ts";
import {
  formFromManifest,
  manifestFromForm,
  parseHubManifestJson,
  validateHubManifest,
} from "../src/content/hub-manifest.ts";
import { registerDemoHub, updateDemoHub, validateHubRegistration } from "../src/content/hub-registration.ts";
import { hubHealthReport } from "../src/content/hub-health.ts";
import { hubPublicationStatus } from "../src/content/hub-publication.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";
import {
  AdminHubRegistrationError,
  registerHub,
  updateHub,
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
  assert.equal(DEMO_ADMIN_DATA.hubs.length, 3);
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
  assert.match(ADMIN_MUTATION_STATUS.reason, /update_hub/);
  assert.match(ADMIN_MUTATION_STATUS.reason, /remain unspecified/);
  assert.equal(ADMIN_MUTATION_STATUS.status, "pending-backend-contract");
});

test("registration rejects unknown courses using the course catalogue", () => {
  const unknown = validateHubRegistration(
    { ...SYNTHETIC_MANIFEST, courses: ["missing-course-key"] },
    "testing",
    true,
    DEMO_ADMIN_DATA,
  );
  assert.equal(unknown.valid, false);
  assert.ok(unknown.issues.some((issue) => issue.code === "UNKNOWN_COURSE"));
});

test("demo update can edit metadata and disable a hub without duplicating it", () => {
  const hub = DEMO_ADMIN_DATA.hubs[0];
  const updated = updateDemoHub(DEMO_ADMIN_DATA, {
    manifest: {
      ...SYNTHETIC_MANIFEST,
      hubId: hub.hubCode,
      name: "Updated Unit 3 title",
      repositoryUrl: hub.repositoryUrl.replace(/\/+$/, ""),
      deploymentUrl: (hub.deploymentUrl ?? "https://unit-3.example.invalid").replace(/\/+$/, ""),
      courses: ["ocr-level-3-it"],
    },
    status: "maintenance",
    active: false,
  });
  assert.equal(updated.snapshot.hubs.filter((item) => item.hubCode === hub.hubCode).length, 1);
  assert.equal(updated.result.hub.hubName, "Updated Unit 3 title");
  assert.equal(updated.result.hub.active, false);
  assert.equal(updated.snapshot.dashboardSummary.registeredHubs, DEMO_ADMIN_DATA.dashboardSummary.registeredHubs);
  assert.equal(updated.snapshot.dashboardSummary.activeHubs, DEMO_ADMIN_DATA.dashboardSummary.activeHubs - 1);
  assert.equal(updated.snapshot.auditEvents[0]?.eventKey, "hub.registration.updated");
  assert.equal(DEMO_ADMIN_DATA.hubs[0].hubName, "Unit 3 Cyber Security Hub");
});

test("editing a hub does not treat its own code as a duplicate", () => {
  const hub = DEMO_ADMIN_DATA.hubs[0];
  const report = validateHubRegistration(
    {
      ...SYNTHETIC_MANIFEST,
      hubId: hub.hubCode,
      name: hub.hubName,
      repositoryUrl: hub.repositoryUrl.replace(/\/+$/, ""),
      deploymentUrl: (hub.deploymentUrl ?? "https://unit-3.example.invalid").replace(/\/+$/, ""),
      courses: ["ocr-level-3-it"],
    },
    hub.status,
    hub.active,
    DEMO_ADMIN_DATA,
    hub.hubCode,
  );
  assert.equal(report.valid, true, report.issues.map((issue) => issue.message).join("; "));
});

test("live updateHub sends only the documented admin_api arguments", async () => {
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
              active: false,
              course_keys: SYNTHETIC_MANIFEST.courses,
            }],
            error: null,
          };
        },
      };
    },
  } as unknown as AdminSupabaseClient;

  const result = await updateHub(client, {
    manifest: SYNTHETIC_MANIFEST,
    status: "testing",
    active: false,
  });
  assert.equal(result.active, false);
  assert.deepEqual(rpcs, [{
    schema: "admin_api",
    name: "update_hub",
    parameters: {
      p_hub_code: SYNTHETIC_MANIFEST.hubId,
      p_manifest: SYNTHETIC_MANIFEST,
      p_status: "testing",
      p_active: false,
    },
  }]);
  assert.equal(ADMIN_API_RPCS.updateHub, "admin_api.update_hub");
});

test("hub publication status uses the catalogue without reimplementing publication", () => {
  const unit14 = DEMO_ADMIN_DATA.hubs.find((hub) => hub.hubCode === "unit-14-software-engineering-for-business");
  assert.ok(unit14);
  const published = hubPublicationStatus(unit14, DEMO_ADMIN_DATA, []);
  assert.equal(published.displayStatus, "published");
  assert.equal(published.catalogueStatus, "published");
  assert.equal(published.packageVersion, "0.1.0");

  const unit3 = DEMO_ADMIN_DATA.hubs[0];
  const localDraft = hubPublicationStatus(unit3, DEMO_ADMIN_DATA, [{
    id: "draft-1",
    title: "Unit 3 draft",
    hubId: unit3.hubCode,
    courseKey: "ocr-level-3-it",
    status: "ready-for-review",
    version: "0.2.0",
    createdAt: "2026-08-14T00:00:00Z",
    updatedAt: "2026-08-14T00:00:00Z",
    publishedAt: null,
    author: "Ada",
    reviewer: "",
    reviewDate: null,
    approvalNotes: "",
    publicationNotes: "",
    publishedBy: "",
    sourcePackageVersion: "0.1.0",
    schemaVersion: "0.1.0",
    basedOnVersionId: null,
    basedOnVersion: null,
    platformPublicationState: "idle",
    platformPublicationError: null,
    platformPublishedAt: null,
    platformPublicationId: null,
    package: {
      hub: { schema: "lp.content.hub", schemaVersion: "0.1.0", id: unit3.hubCode, version: "0.1.0", metadata: {}, relationships: {} },
      curriculum: { schema: "lp.content.curriculum", schemaVersion: "0.1.0", id: "curr", version: "0.1.0", metadata: {}, relationships: {} },
      learningOutcomes: [],
      assignments: [],
      weeks: [],
      sessions: [],
      activities: [],
      questions: [],
      assets: [],
    },
  }]);
  assert.equal(localDraft.displayStatus, "ready-for-review");
  assert.equal(localDraft.displayLabel, "Ready for Review");
});

test("hub health reports registration, course, publication and contract checks", () => {
  const unit14 = DEMO_ADMIN_DATA.hubs.find((hub) => hub.hubCode === "unit-14-software-engineering-for-business");
  assert.ok(unit14);
  const healthy = hubHealthReport(unit14, DEMO_ADMIN_DATA, []);
  assert.equal(healthy.checks.find((check) => check.id === "registered")?.status, "pass");
  assert.equal(healthy.checks.find((check) => check.id === "course-linked")?.status, "pass");
  assert.equal(healthy.checks.find((check) => check.id === "publication")?.status, "pass");
  assert.equal(healthy.checks.find((check) => check.id === "core")?.status, "pass");
  assert.equal(healthy.checks.find((check) => check.id === "ui")?.status, "info");
  assert.equal(healthy.checks.find((check) => check.id === "content")?.status, "info");

  const unlinked = hubHealthReport(unit14, {
    ...DEMO_ADMIN_DATA,
    hubCourseLinks: DEMO_ADMIN_DATA.hubCourseLinks.filter((link) => link.hubCode !== unit14.hubCode),
    curriculumPublications: [],
  }, []);
  assert.equal(unlinked.status, "fail");
  assert.equal(unlinked.checks.find((check) => check.id === "course-linked")?.status, "fail");
  assert.equal(unlinked.checks.find((check) => check.id === "publication")?.status, "fail");
});
