export const ADMIN_API_CONTRACT = Object.freeze({
  schema: "admin_api",
  version: "0.1.0",
  status: "draft",
  mode: "read-only",
});

export const ADMIN_API_VIEWS = Object.freeze({
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
});

export interface HubRecord {
  hubCode: string;
  hubName: string;
  hubVersion: string;
  platformVersion: string;
  subject: string;
  repositoryUrl: string;
  deploymentUrl: string | null;
  curriculumModel: string;
  activityTypes: readonly string[];
  features: Readonly<Record<string, boolean>>;
  status: "planned" | "development" | "testing" | "production" | "maintenance" | "deprecated" | "archived";
  active: boolean;
  certified: boolean;
}

export interface PlatformContractRecord {
  contractKey: string;
  version: string;
  status: "draft" | "active" | "deprecated" | "retired";
  boundary: string;
}

export interface HealthRecord {
  serviceKey: string;
  label: string;
  status: "healthy" | "degraded" | "unavailable" | "unknown";
  checkedAt: string | null;
  message: string;
  source: "fixture" | "live" | "pending";
}

export interface LearnerRecord {
  studentNumber: string;
  displayName: string;
  active: boolean;
  groupCode: string;
  enrolmentCount: number;
}

export interface TeacherRecord {
  staffReference: string;
  displayName: string;
  active: boolean;
  groupCount: number;
  courseAccess: string;
  roleLabel: string;
}

export interface GroupRecord {
  groupCode: string;
  groupName: string;
  academicYear: string;
  yearGroup: string;
  courseTitle: string;
  hubName: string;
  capacity: number | null;
  registrationOpen: boolean;
  active: boolean;
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
  completionState: string;
}

export interface AuditEventRecord {
  eventKey: string;
  actorType: string;
  entityType: string;
  entityKey: string | null;
  outcome: string;
  occurredAt: string;
}

export interface AdminReadService {
  listHubs(): Promise<readonly HubRecord[]>;
  listContracts(): Promise<readonly PlatformContractRecord[]>;
  listHealth(): Promise<readonly HealthRecord[]>;
  listLearners(): Promise<readonly LearnerRecord[]>;
  listTeachers(): Promise<readonly TeacherRecord[]>;
  listGroups(): Promise<readonly GroupRecord[]>;
  listEnrolments(): Promise<readonly EnrolmentRecord[]>;
  listAssignments(): Promise<readonly AssignmentRecord[]>;
  listAuditEvents(): Promise<readonly AuditEventRecord[]>;
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
    "Backend version 0.1.0 intentionally exposes no administrative mutation RPCs.",
  requiredBeforeEnablement: [
    "role and permission requirement",
    "validated transactional RPC",
    "stable conflict and error behaviour",
    "audit event",
    "RLS and integration tests",
  ],
});
