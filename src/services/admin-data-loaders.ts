import type { AdminReadService, HubRecord } from "../api/admin-api.ts";
import { AdminReadError } from "./supabase-admin-service.ts";
import type {
  AdminBootstrapData,
  AnalyticsData,
  AssignmentsResultsData,
  DashboardData,
  HubsCurriculumData,
  PeopleData,
  SystemData,
} from "../api/admin-module-data.ts";
import {
  recordBootstrapReads,
  recordModuleReads,
} from "./admin-module-performance.ts";

/** Anon/RLS empty reads return [] with HTTP 200. That must not look like an empty registry. */
export function assertHubListMatchesSummary(
  hubs: readonly HubRecord[],
  activeHubs: number | null | undefined,
): void {
  if (typeof activeHubs === "number" && activeHubs > 0 && hubs.length === 0) {
    throw new AdminReadError("unavailable", "hubs");
  }
}

export async function loadAdminBootstrapData(
  service: AdminReadService,
): Promise<AdminBootstrapData> {
  recordBootstrapReads(["dashboardSummary"]);
  const dashboardSummary = await service.getDashboardSummary();
  return Object.freeze({ dashboardSummary });
}

export async function loadDashboardData(
  service: AdminReadService,
  bootstrap?: AdminBootstrapData | null,
): Promise<DashboardData> {
  const reads = bootstrap?.dashboardSummary
    ? ["health", "recentAttempts", "hubs", "contracts"]
    : ["dashboardSummary", "health", "recentAttempts", "hubs", "contracts"];
  recordModuleReads("dashboard", reads);

  const [dashboardSummary, health, recentAttempts, hubs, contracts] = await Promise.all([
    bootstrap?.dashboardSummary ?? service.getDashboardSummary(),
    service.listHealth(),
    service.listRecentAttempts(),
    service.listHubs(),
    service.listContracts(),
  ]);
  assertHubListMatchesSummary(hubs, dashboardSummary.activeHubs);

  return Object.freeze({
    dashboardSummary,
    health,
    recentAttempts,
    hubs,
    contracts,
  });
}

export async function loadHubsCurriculumData(
  service: AdminReadService,
  bootstrap?: AdminBootstrapData | null,
): Promise<HubsCurriculumData> {
  recordModuleReads("hubs-curriculum", [
    "hubs",
    "hubCourseLinks",
    "courses",
    "curriculumPublications",
    "curriculumDrafts",
    "auditEvents",
  ]);

  const [hubs, hubCourseLinks, courses, curriculumPublications, curriculumDrafts, auditEvents] =
    await Promise.all([
      service.listHubs(),
      service.listHubCourseLinks(),
      service.listCourses(),
      service.listCurriculumPublications(),
      service.listCurriculumDrafts(),
      service.listAuditEvents(),
    ]);
  assertHubListMatchesSummary(hubs, bootstrap?.dashboardSummary?.activeHubs);

  return Object.freeze({
    hubs,
    hubCourseLinks,
    courses,
    curriculumPublications,
    curriculumDrafts,
    auditEvents,
  });
}

export async function loadPeopleData(service: AdminReadService): Promise<PeopleData> {
  recordModuleReads("people", ["learners", "groups", "teachers", "enrolments"]);
  const [learners, groups, teachers, enrolments] = await Promise.all([
    service.listLearners(),
    service.listGroups(),
    service.listTeachers(),
    service.listEnrolments(),
  ]);
  return Object.freeze({ learners, groups, teachers, enrolments });
}

export async function loadAssignmentsResultsData(
  service: AdminReadService,
): Promise<AssignmentsResultsData> {
  recordModuleReads("assignments-results", [
    "assignments",
    "attempts",
    "responses",
    "activityPerformance",
    "diagnosticSessions",
    "diagnosticResponses",
    "diagnosticSummary",
  ]);
  const [
    assignments,
    attempts,
    responses,
    activityPerformance,
    diagnosticSessions,
    diagnosticResponses,
    diagnosticSummary,
  ] = await Promise.all([
    service.listAssignments(),
    service.listAttempts(),
    service.listResponses(),
    service.listActivityPerformance(),
    service.listDiagnosticSessions(),
    service.listDiagnosticResponses(),
    service.listDiagnosticSummary(),
  ]);
  return Object.freeze({
    assignments,
    attempts,
    responses,
    activityPerformance,
    diagnosticSessions,
    diagnosticResponses,
    diagnosticSummary,
  });
}

export async function loadAnalyticsData(service: AdminReadService): Promise<AnalyticsData> {
  recordModuleReads("analytics", [
    "assessmentOverview",
    "groupPerformance",
    "learnerPerformance",
    "learnerActivityPerformance",
    "activityAnalytics",
    "questionPerformance",
    "questionGroupPerformance",
    "topicPerformance",
    "skillPerformance",
    "diagnosticSessions",
    "diagnosticResponses",
    "diagnosticSummary",
  ]);
  const [
    assessmentOverview,
    groupPerformance,
    learnerPerformance,
    learnerActivityPerformance,
    activityAnalytics,
    questionPerformance,
    questionGroupPerformance,
    topicPerformance,
    skillPerformance,
    diagnosticSessions,
    diagnosticResponses,
    diagnosticSummary,
  ] = await Promise.all([
    service.getAssessmentOverview(),
    service.listGroupPerformance(),
    service.listLearnerPerformance(),
    service.listLearnerActivityPerformance(),
    service.listActivityAnalytics(),
    service.listQuestionPerformance(),
    service.listQuestionGroupPerformance(),
    service.listTopicPerformance(),
    service.listSkillPerformance(),
    service.listDiagnosticSessions(),
    service.listDiagnosticResponses(),
    service.listDiagnosticSummary(),
  ]);
  return Object.freeze({
    assessmentOverview,
    groupPerformance,
    learnerPerformance,
    learnerActivityPerformance,
    activityAnalytics,
    questionPerformance,
    questionGroupPerformance,
    topicPerformance,
    skillPerformance,
    diagnosticSessions,
    diagnosticResponses,
    diagnosticSummary,
  });
}

export async function loadSystemData(service: AdminReadService): Promise<SystemData> {
  recordModuleReads("system", ["health", "hubs", "contracts", "auditEvents", "teachers"]);
  const [health, hubs, contracts, auditEvents, teachers] = await Promise.all([
    service.listHealth(),
    service.listHubs(),
    service.listContracts(),
    service.listAuditEvents(),
    service.listTeachers(),
  ]);
  return Object.freeze({ health, hubs, contracts, auditEvents, teachers });
}

export const MODULE_DATA_LOADERS = {
  dashboard: loadDashboardData,
  "hubs-curriculum": loadHubsCurriculumData,
  people: loadPeopleData,
  "assignments-results": loadAssignmentsResultsData,
  analytics: loadAnalyticsData,
  system: loadSystemData,
} as const;
