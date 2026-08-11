import type {
  AdminReadService,
  AssignmentRecord,
  AuditEventRecord,
  EnrolmentRecord,
  GroupRecord,
  HealthRecord,
  HubRecord,
  LearnerRecord,
  PlatformContractRecord,
  TeacherRecord,
} from "../api/admin-api";

export const HUBS: readonly HubRecord[] = Object.freeze([
  {
    hubCode: "unit-3-cyber-security",
    hubName: "Unit 3 Cyber Security Hub",
    hubVersion: "0.1.0",
    platformVersion: "0.1.0",
    subject: "OCR Level 3 IT Unit 3 Cyber Security",
    repositoryUrl: "https://github.com/Acerosa/unit-3-Cyber-Security-Hub",
    deploymentUrl: "https://acerosa.github.io/unit-3-Cyber-Security-Hub/",
    curriculumModel: "course/unit/week/session/activity/learning-outcome",
    activityTypes: ["retrieval-quiz", "classification", "matching", "reflection"],
    features: { authentication: true, onboarding: true, progress: true, codingExercises: false },
    status: "testing",
    active: true,
    certified: false,
  },
  {
    hubCode: "tlevel-software-development",
    hubName: "T Level Digital Software Development Hub",
    hubVersion: "0.1.0",
    platformVersion: "0.1.0",
    subject: "T Level Digital Software Development",
    repositoryUrl: "https://github.com/Acerosa/tlevel-software-development-hub",
    deploymentUrl: "https://acerosa.github.io/tlevel-software-development-hub/",
    curriculumModel: "course/unit/week/session/activity/learning-outcome",
    activityTypes: ["diagnostic", "classification", "coding-exercise"],
    features: {
      authentication: true,
      onboarding: true,
      progress: true,
      codingExercises: true,
    },
    status: "testing",
    active: true,
    certified: false,
  },
]);

export const CONTRACTS: readonly PlatformContractRecord[] = Object.freeze([
  { contractKey: "learner-api", version: "0.1.0", status: "active", boundary: "Approved api schema views and RPCs only" },
  { contractKey: "submission", version: "0.1.0", status: "active", boundary: "api.submit_attempt · identity derived from auth.uid()" },
  { contractKey: "admin-api", version: "0.1.0", status: "draft", boundary: "Read-only admin_api views" },
]);

export const HEALTH: readonly HealthRecord[] = Object.freeze([
  { serviceKey: "local-database", label: "Local database fixture", status: "healthy", checkedAt: "2026-08-11T09:00:00Z", message: "Synthetic backend fixtures are available for local validation.", source: "fixture" },
  { serviceKey: "hosted-admin-api", label: "Hosted admin API", status: "unknown", checkedAt: null, message: "Live authenticated connectivity has not been configured.", source: "pending" },
  { serviceKey: "authentication-monitoring", label: "Authentication monitoring", status: "unknown", checkedAt: null, message: "No external monitoring collector is configured.", source: "pending" },
  { serviceKey: "deployment-status", label: "Deployment status", status: "unknown", checkedAt: null, message: "No deployment integration contract exists yet.", source: "pending" },
]);

export const LEARNERS: readonly LearnerRecord[] = Object.freeze([
  { studentNumber: "SYNTH-0001", displayName: "Synthetic Student A", active: true, groupCode: "TEST-GROUP-A", enrolmentCount: 1 },
  { studentNumber: "SYNTH-0002", displayName: "Synthetic Student B", active: true, groupCode: "TEST-GROUP-B", enrolmentCount: 1 },
]);

export const TEACHERS: readonly TeacherRecord[] = Object.freeze([
  { staffReference: "SYNTH-TEACHER-A", displayName: "Synthetic Teacher A", active: true, groupCount: 1, courseAccess: "1 via group access", roleLabel: "No fixture platform role" },
  { staffReference: "SYNTH-TEACHER-B", displayName: "Synthetic Teacher B", active: true, groupCount: 1, courseAccess: "1 via group access", roleLabel: "No fixture platform role" },
]);

export const GROUPS: readonly GroupRecord[] = Object.freeze([
  { groupCode: "TEST-GROUP-A", groupName: "Synthetic Test Group A", academicYear: "2026–27", yearGroup: "Year 1", courseTitle: "T Level Digital Software Development", hubName: "T Level Digital Software Development Hub", capacity: null, registrationOpen: true, active: true },
  { groupCode: "TEST-GROUP-B", groupName: "Synthetic Test Group B", academicYear: "2026–27", yearGroup: "Year 2", courseTitle: "T Level Digital Software Development", hubName: "T Level Digital Software Development Hub", capacity: null, registrationOpen: false, active: true },
]);

export const ENROLMENTS: readonly EnrolmentRecord[] = Object.freeze([
  { learnerNumber: "SYNTH-0001", groupCode: "TEST-GROUP-A", joinedOn: "2026-09-01", leftOn: null, status: "active" },
  { learnerNumber: "SYNTH-0002", groupCode: "TEST-GROUP-B", joinedOn: "2026-09-01", leftOn: null, status: "active" },
]);

export const ASSIGNMENTS: readonly AssignmentRecord[] = Object.freeze([
  { groupCode: "TEST-GROUP-A", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", opensAt: null, dueAt: null, required: true, active: true, completionState: "Analytics pending" },
  { groupCode: "TEST-GROUP-B", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", opensAt: null, dueAt: null, required: true, active: true, completionState: "Analytics pending" },
]);

export const AUDIT_EVENTS: readonly AuditEventRecord[] = Object.freeze([]);

export const demoAdminService: AdminReadService = Object.freeze({
  async listHubs() { return HUBS; },
  async listContracts() { return CONTRACTS; },
  async listHealth() { return HEALTH; },
  async listLearners() { return LEARNERS; },
  async listTeachers() { return TEACHERS; },
  async listGroups() { return GROUPS; },
  async listEnrolments() { return ENROLMENTS; },
  async listAssignments() { return ASSIGNMENTS; },
  async listAuditEvents() { return AUDIT_EVENTS; },
});

export const DEMO_DATA_NOTICE = Object.freeze({
  title: "Foundation data",
  message:
    "Showing reviewed registry manifests and synthetic local fixtures. Live admin API connectivity is not configured.",
});
