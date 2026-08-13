export const ADMIN_API_CONTRACT = Object.freeze({
  schema: "admin_api",
  version: "0.2.0",
  status: "draft",
  mode: "read-models-with-curriculum-publication",
});

export const ADMIN_API_VIEWS = Object.freeze({
  currentStaffContext: "admin_api.current_staff_context",
  hubs: "admin_api.hubs",
  hubCourseLinks: "admin_api.hub_course_links",
  platformContracts: "admin_api.platform_contracts",
  staffRoles: "admin_api.staff_roles",
  auditEvents: "admin_api.audit_events",
  operationalHealth: "admin_api.operational_health",
  learners: "admin_api.learners",
  groups: "admin_api.groups",
  enrolments: "admin_api.enrolments",
  assignments: "admin_api.assignments",
  attempts: "admin_api.attempts",
  dashboardSummary: "admin_api.dashboard_summary",
  activityPerformance: "admin_api.activity_performance",
  curriculumPublications: "admin_api.curriculum_publications",
});

export type HubLifecycle =
  | "planned"
  | "development"
  | "testing"
  | "production"
  | "maintenance"
  | "deprecated"
  | "archived";

export interface CurrentStaffContextRecord {
  teacherId: string;
  staffReference: string;
  displayName: string;
  active: boolean;
  activeRoles: readonly string[];
}

export interface HubRecord {
  hubCode: string;
  hubName: string;
  description: string;
  hubVersion: string;
  manifestVersion: string;
  coreVersion: string;
  learnerApiVersion: string;
  submissionContractVersion: string;
  platformVersion: string;
  subject: string | null;
  repositoryUrl: string;
  deploymentUrl: string | null;
  curriculumModel: string | null;
  activityTypes: readonly string[];
  evidenceCapabilities: readonly string[];
  features: Readonly<Record<string, boolean>>;
  compatibility: Readonly<Record<string, unknown>>;
  status: HubLifecycle;
  active: boolean;
  certificationState: string | null;
}

export interface HubCourseLinkRecord {
  hubCode: string;
  courseKey: string;
  courseTitle: string;
  active: boolean;
  linkedAt: string;
}

export interface PlatformContractRecord {
  contractKey: string;
  version: string;
  status: "draft" | "active" | "deprecated" | "retired";
  boundary: string;
  compatibility: Readonly<Record<string, unknown>>;
}

export interface HealthRecord {
  serviceKey: string;
  label: string;
  status: "healthy" | "degraded" | "unavailable" | "unknown";
  checkedAt: string | null;
  validUntil: string | null;
  message: string;
  source: "fixture" | "live" | "pending";
}

export interface LearnerRecord {
  studentNumber: string;
  displayName: string;
  active: boolean;
  groupCodes: readonly string[];
  activeEnrolmentCount: number;
}

export interface TeacherRecord {
  staffReference: string;
  displayName: string;
  active: boolean;
  roleLabel: string;
}

export interface GroupRecord {
  groupCode: string;
  groupName: string;
  academicYear: string;
  yearGroup: string;
  courseKey: string;
  courseTitle: string;
  registrationOpen: boolean;
  active: boolean;
  activeLearnerCount: number;
}

export interface EnrolmentRecord {
  learnerNumber: string;
  groupCode: string;
  joinedOn: string;
  leftOn: string | null;
  status: string;
}

export interface AssignmentRecord {
  groupCode: string;
  activityKey: string;
  activityVersion: string;
  opensAt: string | null;
  dueAt: string | null;
  required: boolean;
  active: boolean;
}

export interface AttemptRecord {
  attemptId: string;
  learnerNumber: string;
  groupCode: string;
  activityKey: string;
  activityVersion: string;
  attemptNumber: number;
  status: string;
  score: number;
  maxScore: number;
  markingSource: string;
  evidenceLevel: string;
  receivedAt: string;
  completedAt: string;
}

export interface ActivityPerformanceRecord {
  groupCode: string;
  activityKey: string;
  activityVersion: string;
  completedAttempts: number;
  learnerCount: number;
  averageScorePercentage: number | null;
  bestScorePercentage: number | null;
  firstCompletedAt: string;
  latestCompletedAt: string;
}

export interface DashboardSummaryRecord {
  registeredHubs: number;
  activeHubs: number;
  activeLearners: number;
  activeGroups: number;
  activeEnrolments: number;
  assignments: number;
  recentAttempts: number;
  completedAttempts: number;
  averageScorePercentage: number | null;
  healthyServices: number;
  serviceCount: number;
  activeContracts: number;
  contractCount: number;
}

export interface AuditEventRecord {
  eventKey: string;
  actorType: string;
  entityType: string;
  entityKey: string | null;
  outcome: string;
  occurredAt: string;
}

export interface CurriculumPublicationRecord {
  id: string;
  hubCode: string;
  courseKey: string;
  packageVersion: string;
  schemaVersion: string;
  sourcePackageVersion: string;
  status: "published" | "superseded";
  author: string;
  reviewer: string;
  publicationNotes: string;
  publishedBy: string;
  createdAt: string;
  publishedAt: string;
  contentHash: string;
}

export interface PlatformPublicationResult {
  id: string;
  hubCode: string;
  courseKey: string;
  packageVersion: string;
  status: string;
  publishedAt: string;
  idempotent: boolean;
}

export interface AdminDataSnapshot {
  hubs: readonly HubRecord[];
  hubCourseLinks: readonly HubCourseLinkRecord[];
  contracts: readonly PlatformContractRecord[];
  health: readonly HealthRecord[];
  learners: readonly LearnerRecord[];
  teachers: readonly TeacherRecord[];
  groups: readonly GroupRecord[];
  enrolments: readonly EnrolmentRecord[];
  assignments: readonly AssignmentRecord[];
  attempts: readonly AttemptRecord[];
  activityPerformance: readonly ActivityPerformanceRecord[];
  dashboardSummary: DashboardSummaryRecord;
  auditEvents: readonly AuditEventRecord[];
  curriculumPublications: readonly CurriculumPublicationRecord[];
}

export interface AdminReadService {
  getCurrentStaffContext(): Promise<CurrentStaffContextRecord | null>;
  listHubs(): Promise<readonly HubRecord[]>;
  listHubCourseLinks(): Promise<readonly HubCourseLinkRecord[]>;
  listContracts(): Promise<readonly PlatformContractRecord[]>;
  listHealth(): Promise<readonly HealthRecord[]>;
  listTeachers(): Promise<readonly TeacherRecord[]>;
  listLearners(): Promise<readonly LearnerRecord[]>;
  listGroups(): Promise<readonly GroupRecord[]>;
  listEnrolments(): Promise<readonly EnrolmentRecord[]>;
  listAssignments(): Promise<readonly AssignmentRecord[]>;
  listAttempts(): Promise<readonly AttemptRecord[]>;
  listActivityPerformance(): Promise<readonly ActivityPerformanceRecord[]>;
  getDashboardSummary(): Promise<DashboardSummaryRecord>;
  listAuditEvents(): Promise<readonly AuditEventRecord[]>;
  listCurriculumPublications(): Promise<readonly CurriculumPublicationRecord[]>;
}

export interface AdminMutationService {
  readonly status: "pending-backend-contract";
  registerHub(input: unknown): Promise<never>;
  updateHub(hubCode: string, input: unknown): Promise<never>;
  deactivateHub(hubCode: string): Promise<never>;
  updateCurriculum(input: unknown): Promise<never>;
  updateLearner(input: unknown): Promise<never>;
  updateTeacher(input: unknown): Promise<never>;
  updateGroup(input: unknown): Promise<never>;
  updateEnrolment(input: unknown): Promise<never>;
  updateAssignment(input: unknown): Promise<never>;
}

export const ADMIN_MUTATION_STATUS = Object.freeze({
  status: "pending-backend-contract" as const,
  reason:
    "Backend version 0.2.0 exposes curriculum publication only. Other administrative mutation RPCs remain unspecified.",
  requiredBeforeEnablement: [
    "role and permission requirement",
    "validated transactional RPC",
    "stable conflict and error behaviour",
    "audit event",
    "RLS and integration tests",
  ],
});
