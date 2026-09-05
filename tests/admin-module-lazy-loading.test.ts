import assert from "node:assert/strict";
import test from "node:test";
import type { AdminReadService } from "../src/api/admin-api.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";
import type { PeopleData, DashboardData } from "../src/api/admin-module-data.ts";
import {
  createEmptyModuleCache,
  mergeModuleCacheToSnapshot,
  sliceDemoModuleData,
} from "../src/api/admin-module-data.ts";
import {
  loadAdminBootstrapData,
  loadAnalyticsData,
  loadAssignmentsResultsData,
  loadDashboardData,
  loadHubsCurriculumData,
  loadPeopleData,
  loadSystemData,
} from "../src/services/admin-data-loaders.ts";
import {
  resetAdminModulePerformance,
  getAdminModulePerformanceSnapshot,
} from "../src/services/admin-module-performance.ts";
import {
  fetchAdminBootstrapData,
  fetchModuleData,
  invalidateModuleCache,
  isModuleReady,
} from "../src/stores/admin-module-loader.ts";

function createTrackingService(): AdminReadService & { calls: string[] } {
  const calls: string[] = [];
  const track = (name: string) => {
    calls.push(name);
    return Promise.resolve([] as never);
  };

  return {
    calls,
    getCurrentStaffContext: async () => ({
      teacherId: "teacher-1",
      staffReference: "staff-1",
      displayName: "Admin",
      active: true,
      activeRoles: ["platform_admin"],
    }),
    listHubs: async () => track("listHubs"),
    listHubCourseLinks: async () => track("listHubCourseLinks"),
    listCourses: async () => track("listCourses"),
    listContracts: async () => track("listContracts"),
    listHealth: async () => track("listHealth"),
    listTeachers: async () => track("listTeachers"),
    listLearners: async () => track("listLearners"),
    listGroups: async () => track("listGroups"),
    listEnrolments: async () => track("listEnrolments"),
    listAssignments: async () => track("listAssignments"),
    listAttempts: async () => track("listAttempts"),
    listRecentAttempts: async () => track("listRecentAttempts"),
    listResponses: async () => track("listResponses"),
    listActivityPerformance: async () => track("listActivityPerformance"),
    getAssessmentOverview: async () => {
      calls.push("getAssessmentOverview");
      return null;
    },
    listGroupPerformance: async () => track("listGroupPerformance"),
    listLearnerPerformance: async () => track("listLearnerPerformance"),
    listLearnerActivityPerformance: async () => track("listLearnerActivityPerformance"),
    listActivityAnalytics: async () => track("listActivityAnalytics"),
    listQuestionPerformance: async () => track("listQuestionPerformance"),
    listQuestionGroupPerformance: async () => track("listQuestionGroupPerformance"),
    listTopicPerformance: async () => track("listTopicPerformance"),
    listSkillPerformance: async () => track("listSkillPerformance"),
    getDashboardSummary: async () => {
      calls.push("getDashboardSummary");
      return {
        registeredHubs: 1,
        activeHubs: 1,
        activeLearners: 2,
        activeGroups: 1,
        activeEnrolments: 2,
        assignments: 3,
        recentAttempts: 1,
        completedAttempts: 1,
        averageScorePercentage: 80,
        healthyServices: 1,
        serviceCount: 1,
        activeContracts: 1,
        contractCount: 1,
      };
    },
    listAuditEvents: async () => track("listAuditEvents"),
    listCurriculumPublications: async () => track("listCurriculumPublications"),
    listCurriculumDrafts: async () => track("listCurriculumDrafts"),
    listDiagnosticSessions: async () => track("listDiagnosticSessions"),
    listDiagnosticResponses: async () => track("listDiagnosticResponses"),
    listDiagnosticSummary: async () => track("listDiagnosticSummary"),
  };
}

test("bootstrap loads only dashboard summary", async () => {
  resetAdminModulePerformance();
  const service = createTrackingService();
  await loadAdminBootstrapData(service);
  assert.deepEqual(service.calls, ["getDashboardSummary"]);
  const perf = getAdminModulePerformanceSnapshot();
  assert.deepEqual(perf.bootstrapReads, ["dashboardSummary"]);
});

test("people module loads only people datasets", async () => {
  const service = createTrackingService();
  await loadPeopleData(service);
  assert.deepEqual(
    service.calls.sort(),
    ["listEnrolments", "listGroups", "listLearners", "listTeachers"].sort(),
  );
});

test("analytics module loads only analytics datasets", async () => {
  const service = createTrackingService();
  await loadAnalyticsData(service);
  assert.deepEqual(
    service.calls.sort(),
    [
      "getAssessmentOverview",
      "listActivityAnalytics",
      "listGroupPerformance",
      "listLearnerPerformance",
      "listLearnerActivityPerformance",
      "listQuestionGroupPerformance",
      "listQuestionPerformance",
      "listSkillPerformance",
      "listTopicPerformance",
      "listDiagnosticResponses",
      "listDiagnosticSessions",
      "listDiagnosticSummary",
    ].sort(),
  );
});

test("hubs curriculum module loads its own datasets", async () => {
  const service = createTrackingService();
  await loadHubsCurriculumData(service);
  assert.deepEqual(
    service.calls.sort(),
    [
      "listAuditEvents",
      "listCourses",
      "listCurriculumDrafts",
      "listCurriculumPublications",
      "listHubCourseLinks",
      "listHubs",
    ].sort(),
  );
});

test("assignments module loads its own datasets", async () => {
  const service = createTrackingService();
  await loadAssignmentsResultsData(service);
  assert.deepEqual(
    service.calls.sort(),
    ["listActivityPerformance", "listAssignments", "listAttempts", "listDiagnosticResponses", "listDiagnosticSessions", "listDiagnosticSummary", "listResponses"].sort(),
  );
});

test("system module loads its own datasets", async () => {
  const service = createTrackingService();
  await loadSystemData(service);
  assert.deepEqual(
    service.calls.sort(),
    ["listAuditEvents", "listContracts", "listHealth", "listHubs", "listTeachers"].sort(),
  );
});

test("dashboard module loads recent attempts instead of full attempt history", async () => {
  const service = createTrackingService();
  const bootstrap = await loadAdminBootstrapData(service);
  service.calls.length = 0;
  await loadDashboardData(service, bootstrap);
  assert.deepEqual(
    service.calls.sort(),
    ["listContracts", "listHealth", "listHubs", "listRecentAttempts"].sort(),
  );
  assert.equal(service.calls.includes("listAttempts"), false);
});

test("demo slices derive module data without backend reads", async () => {
  const service = createTrackingService();
  const people = await fetchModuleData("people", service, { demoSnapshot: DEMO_ADMIN_DATA });
  assert.equal(people.learners.length, DEMO_ADMIN_DATA.learners.length);
  assert.equal(service.calls.length, 0);
});

test("module cache reuse marks ready entries", () => {
  const cache = createEmptyModuleCache();
  cache.people = {
    status: "ready",
    data: sliceDemoModuleData(DEMO_ADMIN_DATA, "people") as PeopleData,
    error: null,
  };
  assert.equal(isModuleReady(cache.people), true);
  const snapshot = mergeModuleCacheToSnapshot(cache);
  assert.equal(snapshot.learners.length, DEMO_ADMIN_DATA.learners.length);
  assert.equal(snapshot.assignments.length, 0);
});

test("invalidateModuleCache clears selected modules only", () => {
  const cache = createEmptyModuleCache();
  cache.people = {
    status: "ready",
    data: sliceDemoModuleData(DEMO_ADMIN_DATA, "people") as PeopleData,
    error: null,
  };
  cache.dashboard = {
    status: "ready",
    data: sliceDemoModuleData(DEMO_ADMIN_DATA, "dashboard") as DashboardData,
    error: null,
  };
  const next = invalidateModuleCache(cache, ["people"]);
  assert.equal(next.people.status, "idle");
  assert.equal(next.people.data, null);
  assert.equal(next.dashboard.status, "ready");
});

test("fetchAdminBootstrapData uses demo snapshot without reads", async () => {
  const service = createTrackingService();
  const bootstrap = await fetchAdminBootstrapData(service, DEMO_ADMIN_DATA);
  assert.equal(bootstrap.dashboardSummary.registeredHubs, DEMO_ADMIN_DATA.dashboardSummary.registeredHubs);
  assert.equal(service.calls.length, 0);
});

test("analytics failure does not affect merged bootstrap snapshot", () => {
  const cache = createEmptyModuleCache();
  cache.dashboard = {
    status: "ready",
    data: sliceDemoModuleData(DEMO_ADMIN_DATA, "dashboard") as DashboardData,
    error: null,
  };
  cache.analytics = {
    status: "error",
    data: null,
    error: "Analytics unavailable",
  };
  const snapshot = mergeModuleCacheToSnapshot(cache);
  assert.ok(snapshot.dashboardSummary.registeredHubs >= 0);
  assert.equal(snapshot.groupPerformance.length, 0);
  assert.equal(cache.analytics.status, "error");
});

test("merge uses bootstrap dashboard summary before dashboard module loads", () => {
  const cache = createEmptyModuleCache();
  const bootstrap = {
    dashboardSummary: {
      ...DEMO_ADMIN_DATA.dashboardSummary,
      registeredHubs: 99,
    },
  };
  const snapshot = mergeModuleCacheToSnapshot(cache, bootstrap);
  assert.equal(snapshot.dashboardSummary.registeredHubs, 99);
  assert.equal(snapshot.learners.length, 0);
});

test("performance snapshot records bootstrap read count", async () => {
  resetAdminModulePerformance();
  const service = createTrackingService();
  await fetchAdminBootstrapData(service);
  const perf = getAdminModulePerformanceSnapshot();
  assert.equal(perf.bootstrapReads.length, 1);
});
