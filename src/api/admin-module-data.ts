import type {
  ActivityAnalyticsRecord,
  ActivityPerformanceRecord,
  AdminDataSnapshot,
  AssessmentOverviewRecord,
  AssignmentRecord,
  AttemptRecord,
  RecentAttemptRecord,
  AuditEventRecord,
  CourseRecord,
  CurriculumDraftSummary,
  CurriculumPublicationRecord,
  DashboardSummaryRecord,
  EnrolmentRecord,
  GroupPerformanceRecord,
  GroupRecord,
  HealthRecord,
  HubCourseLinkRecord,
  HubRecord,
  LearnerActivityPerformanceRecord,
  LearnerPerformanceRecord,
  LearnerRecord,
  PlatformContractRecord,
  QuestionGroupPerformanceRecord,
  QuestionPerformanceRecord,
  ResponseRecord,
  SkillPerformanceRecord,
  TeacherRecord,
  TopicPerformanceRecord,
} from "./admin-api.ts";
import type { AdminModuleId } from "../router/modules.ts";

export type AdminModuleDataKey =
  | "dashboard"
  | "hubs-curriculum"
  | "people"
  | "assignments-results"
  | "analytics"
  | "system";

export type ModuleLoadStatus = "idle" | "loading" | "ready" | "refreshing" | "error";

export interface AdminBootstrapData {
  dashboardSummary: DashboardSummaryRecord;
}

export interface DashboardData {
  dashboardSummary: DashboardSummaryRecord;
  health: readonly HealthRecord[];
  recentAttempts: readonly RecentAttemptRecord[];
  hubs: readonly HubRecord[];
  contracts: readonly PlatformContractRecord[];
}

export interface HubsCurriculumData {
  hubs: readonly HubRecord[];
  hubCourseLinks: readonly HubCourseLinkRecord[];
  courses: readonly CourseRecord[];
  curriculumPublications: readonly CurriculumPublicationRecord[];
  curriculumDrafts: readonly CurriculumDraftSummary[];
  auditEvents: readonly AuditEventRecord[];
}

export interface PeopleData {
  learners: readonly LearnerRecord[];
  groups: readonly GroupRecord[];
  teachers: readonly TeacherRecord[];
  enrolments: readonly EnrolmentRecord[];
}

export interface AssignmentsResultsData {
  assignments: readonly AssignmentRecord[];
  attempts: readonly AttemptRecord[];
  responses: readonly ResponseRecord[];
  activityPerformance: readonly ActivityPerformanceRecord[];
}

export interface AnalyticsData {
  assessmentOverview: AssessmentOverviewRecord | null;
  groupPerformance: readonly GroupPerformanceRecord[];
  learnerPerformance: readonly LearnerPerformanceRecord[];
  learnerActivityPerformance: readonly LearnerActivityPerformanceRecord[];
  activityAnalytics: readonly ActivityAnalyticsRecord[];
  questionPerformance: readonly QuestionPerformanceRecord[];
  questionGroupPerformance: readonly QuestionGroupPerformanceRecord[];
  topicPerformance: readonly TopicPerformanceRecord[];
  skillPerformance: readonly SkillPerformanceRecord[];
}

export interface SystemData {
  health: readonly HealthRecord[];
  hubs: readonly HubRecord[];
  contracts: readonly PlatformContractRecord[];
  auditEvents: readonly AuditEventRecord[];
  teachers: readonly TeacherRecord[];
}

export type AdminModulePayload = {
  dashboard: DashboardData;
  "hubs-curriculum": HubsCurriculumData;
  people: PeopleData;
  "assignments-results": AssignmentsResultsData;
  analytics: AnalyticsData;
  system: SystemData;
};

export interface AdminModuleCacheEntry<K extends AdminModuleDataKey = AdminModuleDataKey> {
  status: ModuleLoadStatus;
  data: AdminModulePayload[K] | null;
  error: string | null;
}

export type AdminModuleCacheState = {
  [K in AdminModuleDataKey]: AdminModuleCacheEntry<K>;
};

export const ADMIN_MODULE_DATA_KEYS = [
  "dashboard",
  "hubs-curriculum",
  "people",
  "assignments-results",
  "analytics",
  "system",
] as const satisfies readonly AdminModuleDataKey[];

export const EMPTY_DASHBOARD_SUMMARY: DashboardSummaryRecord = Object.freeze({
  registeredHubs: 0,
  activeHubs: 0,
  activeLearners: 0,
  activeGroups: 0,
  activeEnrolments: 0,
  assignments: 0,
  recentAttempts: 0,
  completedAttempts: 0,
  averageScorePercentage: null,
  healthyServices: 0,
  serviceCount: 0,
  activeContracts: 0,
  contractCount: 0,
});

export function createEmptyModuleCache(): AdminModuleCacheState {
  const entry = <K extends AdminModuleDataKey>(): AdminModuleCacheEntry<K> => ({
    status: "idle",
    data: null,
    error: null,
  });
  return {
    dashboard: entry<"dashboard">(),
    "hubs-curriculum": entry<"hubs-curriculum">(),
    people: entry<"people">(),
    "assignments-results": entry<"assignments-results">(),
    analytics: entry<"analytics">(),
    system: entry<"system">(),
  };
}

export function moduleDataKeyForRoute(moduleId: AdminModuleId): AdminModuleDataKey | null {
  switch (moduleId) {
    case "dashboard":
      return "dashboard";
    case "hubs":
    case "courses":
    case "curriculum":
      return "hubs-curriculum";
    case "people":
    case "learners":
    case "teachers":
    case "groups":
    case "enrolments":
      return "people";
    case "assessment":
    case "assignments":
    case "results":
    case "attempts":
      return "assignments-results";
    case "analytics":
      return "analytics";
    case "system":
    case "monitoring":
    case "certification":
    case "configuration":
    case "audit":
      return "system";
    default:
      return null;
  }
}

export function moduleLoadingLabel(key: AdminModuleDataKey): string {
  switch (key) {
    case "dashboard":
      return "Loading dashboard…";
    case "hubs-curriculum":
      return "Loading hubs and curriculum…";
    case "people":
      return "Loading people…";
    case "assignments-results":
      return "Loading assignments and results…";
    case "analytics":
      return "Loading analytics…";
    case "system":
      return "Loading system data…";
  }
}

export function mergeModuleCacheToSnapshot(
  cache: AdminModuleCacheState,
  bootstrap?: AdminBootstrapData | null,
): AdminDataSnapshot {
  const dashboard = cache.dashboard.data;
  const hubs = cache["hubs-curriculum"].data;
  const people = cache.people.data;
  const assignments = cache["assignments-results"].data;
  const analytics = cache.analytics.data;
  const system = cache.system.data;

  return Object.freeze({
    dashboardSummary: dashboard?.dashboardSummary ?? bootstrap?.dashboardSummary ?? EMPTY_DASHBOARD_SUMMARY,
    health: system?.health ?? dashboard?.health ?? [],
    hubs: hubs?.hubs ?? dashboard?.hubs ?? system?.hubs ?? [],
    hubCourseLinks: hubs?.hubCourseLinks ?? [],
    courses: hubs?.courses ?? [],
    contracts: system?.contracts ?? dashboard?.contracts ?? [],
    learners: people?.learners ?? [],
    teachers: people?.teachers ?? system?.teachers ?? [],
    groups: people?.groups ?? [],
    enrolments: people?.enrolments ?? [],
    assignments: assignments?.assignments ?? [],
    attempts: assignments?.attempts ?? [],
    responses: assignments?.responses ?? [],
    activityPerformance: assignments?.activityPerformance ?? [],
    assessmentOverview: analytics?.assessmentOverview ?? null,
    groupPerformance: analytics?.groupPerformance ?? [],
    learnerPerformance: analytics?.learnerPerformance ?? [],
    learnerActivityPerformance: analytics?.learnerActivityPerformance ?? [],
    activityAnalytics: analytics?.activityAnalytics ?? [],
    questionPerformance: analytics?.questionPerformance ?? [],
    questionGroupPerformance: analytics?.questionGroupPerformance ?? [],
    topicPerformance: analytics?.topicPerformance ?? [],
    skillPerformance: analytics?.skillPerformance ?? [],
    auditEvents: system?.auditEvents ?? hubs?.auditEvents ?? [],
    curriculumPublications: hubs?.curriculumPublications ?? [],
    curriculumDrafts: hubs?.curriculumDrafts ?? [],
  });
}

export function sliceDemoModuleData(snapshot: AdminDataSnapshot, key: "dashboard"): DashboardData;
export function sliceDemoModuleData(snapshot: AdminDataSnapshot, key: "hubs-curriculum"): HubsCurriculumData;
export function sliceDemoModuleData(snapshot: AdminDataSnapshot, key: "people"): PeopleData;
export function sliceDemoModuleData(snapshot: AdminDataSnapshot, key: "assignments-results"): AssignmentsResultsData;
export function sliceDemoModuleData(snapshot: AdminDataSnapshot, key: "analytics"): AnalyticsData;
export function sliceDemoModuleData(snapshot: AdminDataSnapshot, key: "system"): SystemData;
export function sliceDemoModuleData(
  snapshot: AdminDataSnapshot,
  key: AdminModuleDataKey,
): AdminModulePayload[AdminModuleDataKey] {
  switch (key) {
    case "dashboard":
      return {
        dashboardSummary: snapshot.dashboardSummary,
        health: snapshot.health,
        recentAttempts: snapshot.attempts.slice(0, 5).map((attempt) => ({
          attemptId: attempt.attemptId,
          learnerNumber: attempt.learnerNumber,
          activityKey: attempt.activityKey,
          activityVersion: attempt.activityVersion,
          status: attempt.status,
          score: attempt.score,
          maxScore: attempt.maxScore,
          completedAt: attempt.completedAt,
        })),
        hubs: snapshot.hubs,
        contracts: snapshot.contracts,
      };
    case "hubs-curriculum":
      return {
        hubs: snapshot.hubs,
        hubCourseLinks: snapshot.hubCourseLinks,
        courses: snapshot.courses,
        curriculumPublications: snapshot.curriculumPublications,
        curriculumDrafts: snapshot.curriculumDrafts,
        auditEvents: snapshot.auditEvents,
      };
    case "people":
      return {
        learners: snapshot.learners,
        groups: snapshot.groups,
        teachers: snapshot.teachers,
        enrolments: snapshot.enrolments,
      };
    case "assignments-results":
      return {
        assignments: snapshot.assignments,
        attempts: snapshot.attempts,
        responses: snapshot.responses,
        activityPerformance: snapshot.activityPerformance,
      };
    case "analytics":
      return {
        assessmentOverview: snapshot.assessmentOverview,
        groupPerformance: snapshot.groupPerformance,
        learnerPerformance: snapshot.learnerPerformance,
        learnerActivityPerformance: snapshot.learnerActivityPerformance,
        activityAnalytics: snapshot.activityAnalytics,
        questionPerformance: snapshot.questionPerformance,
        questionGroupPerformance: snapshot.questionGroupPerformance,
        topicPerformance: snapshot.topicPerformance,
        skillPerformance: snapshot.skillPerformance,
      };
    case "system":
      return {
        health: snapshot.health,
        hubs: snapshot.hubs,
        contracts: snapshot.contracts,
        auditEvents: snapshot.auditEvents,
        teachers: snapshot.teachers,
      };
  }
}
