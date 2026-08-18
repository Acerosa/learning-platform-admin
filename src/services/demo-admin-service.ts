import type {
  ActivityPerformanceRecord,
  AdminDataSnapshot,
  AdminReadService,
  AssignmentRecord,
  AttemptRecord,
  AuditEventRecord,
  CourseRecord,
  CurrentStaffContextRecord,
  CurriculumDraftSummary,
  CurriculumPublicationRecord,
  DashboardSummaryRecord,
  EnrolmentRecord,
  GroupRecord,
  HealthRecord,
  HubCourseLinkRecord,
  HubRecord,
  LearnerRecord,
  PlatformContractRecord,
  ResponseRecord,
  TeacherRecord,
} from "../api/admin-api";

export const HUBS: readonly HubRecord[] = Object.freeze([
  {
    hubCode: "unit-3-cyber-security",
    hubName: "Unit 3 Cyber Security Hub",
    description: "Learner hub for OCR Level 3 IT Unit 3 Cyber Security.",
    hubVersion: "0.1.0",
    manifestVersion: "1.0.0",
    coreVersion: "0.1.0",
    learnerApiVersion: "0.1.0",
    submissionContractVersion: "0.1.0",
    platformVersion: "0.1.0",
    subject: "OCR Level 3 IT Unit 3 Cyber Security",
    repositoryUrl: "https://github.com/Acerosa/unit-3-Cyber-Security-Hub",
    deploymentUrl: "https://acerosa.github.io/unit-3-Cyber-Security-Hub/",
    curriculumModel: "course/unit/week/session/activity/learning-outcome",
    activityTypes: ["retrieval-quiz", "classification", "matching", "reflection"],
    evidenceCapabilities: ["question-level"],
    features: { authentication: true, onboarding: true, progress: true, codingExercises: false },
    compatibility: {
      required: {
        coreVersion: "0.1.0",
        learnerApiContractVersion: "0.1.0",
        submissionContractVersion: "0.1.0",
      },
    },
    status: "testing",
    active: true,
    certificationState: null,
  },
  {
    hubCode: "tlevel-software-development",
    hubName: "T Level Digital Software Development Hub",
    description: "Learner hub for T Level Digital Software Development.",
    hubVersion: "0.1.0",
    manifestVersion: "1.0.0",
    coreVersion: "0.1.0",
    learnerApiVersion: "0.1.0",
    submissionContractVersion: "0.1.0",
    platformVersion: "0.1.0",
    subject: "T Level Digital Software Development",
    repositoryUrl: "https://github.com/Acerosa/tlevel-software-development-hub",
    deploymentUrl: "https://acerosa.github.io/tlevel-software-development-hub/",
    curriculumModel: "course/unit/week/session/activity/learning-outcome",
    activityTypes: ["diagnostic", "classification", "coding-exercise"],
    evidenceCapabilities: ["question-level"],
    features: {
      authentication: true,
      onboarding: true,
      progress: true,
      codingExercises: true,
    },
    compatibility: {
      required: {
        coreVersion: "0.1.0",
        learnerApiContractVersion: "0.1.0",
        submissionContractVersion: "0.1.0",
      },
    },
    status: "testing",
    active: true,
    certificationState: null,
  },
  {
    hubCode: "unit-14-software-engineering-for-business",
    hubName: "Unit 14 Software Engineering for Business Hub",
    description: "Learner hub for OCR Level 3 IT Unit 14 Software Engineering for Business.",
    hubVersion: "0.1.0",
    manifestVersion: "1.0.0",
    coreVersion: "0.1.0",
    learnerApiVersion: "0.1.0",
    submissionContractVersion: "0.1.0",
    platformVersion: "0.1.0",
    subject: "OCR Level 3 IT Unit 14 Software Engineering for Business",
    repositoryUrl: "https://github.com/Acerosa/unit-14-software-engineering-for-business-hub",
    deploymentUrl: "https://acerosa.github.io/unit-14-software-engineering-for-business-hub/",
    curriculumModel: "course/unit/week/session/activity/learning-outcome",
    activityTypes: ["classification", "diagnostic", "code-reading"],
    evidenceCapabilities: ["question-level"],
    features: { authentication: true, onboarding: true, progress: true, codingExercises: false },
    compatibility: {
      required: {
        coreVersion: "0.1.0",
        learnerApiContractVersion: "0.1.0",
        submissionContractVersion: "0.1.0",
      },
    },
    status: "testing",
    active: true,
    certificationState: null,
  },
]);

export const HUB_COURSE_LINKS: readonly HubCourseLinkRecord[] = Object.freeze([
  {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    active: true,
    linkedAt: "2026-08-11T00:00:00Z",
  },
  {
    hubCode: "tlevel-software-development",
    courseKey: "t-level-digital-software-development",
    courseTitle: "T Level Digital Software Development",
    active: true,
    linkedAt: "2026-08-11T00:00:00Z",
  },
  {
    hubCode: "unit-14-software-engineering-for-business",
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    active: true,
    linkedAt: "2026-08-13T00:00:00Z",
  },
]);

export const COURSES: readonly CourseRecord[] = Object.freeze([
  {
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    code: "OCR-L3-IT",
    qualificationLevel: "3",
    active: true,
  },
  {
    courseKey: "t-level-digital-software-development",
    courseTitle: "T Level Digital Software Development",
    code: "TLEVEL-DSD",
    qualificationLevel: "3",
    active: true,
  },
]);

export const CONTRACTS: readonly PlatformContractRecord[] = Object.freeze([
  { contractKey: "hub-manifest", version: "1.0.0", status: "active", boundary: "LHDS learning-platform-hub.json", compatibility: {} },
  { contractKey: "learning-platform-core", version: "0.1.0", status: "active", boundary: "Shared frontend platform", compatibility: {} },
  { contractKey: "learner-api", version: "0.1.0", status: "active", boundary: "Approved api schema views and RPCs only", compatibility: {} },
  { contractKey: "submission", version: "0.1.0", status: "active", boundary: "api.submit_attempt · identity derived from auth.uid()", compatibility: {} },
  { contractKey: "admin-api", version: "0.1.0", status: "retired", boundary: "Read-only foundation", compatibility: {} },
  { contractKey: "admin-api", version: "0.2.0", status: "draft", boundary: "Authenticated staff read models", compatibility: { previousVersion: "0.1.0" } },
]);

export const HEALTH: readonly HealthRecord[] = Object.freeze([
  { serviceKey: "local-database", label: "Local Database", status: "healthy", checkedAt: "2026-08-11T09:00:00Z", validUntil: "2026-08-12T09:00:00Z", message: "Synthetic backend fixtures are available for local validation.", source: "fixture" },
  { serviceKey: "hosted-admin-api", label: "Hosted Admin API", status: "unknown", checkedAt: null, validUntil: null, message: "Live authenticated connectivity is not configured in demo mode.", source: "pending" },
]);

export const LEARNERS: readonly LearnerRecord[] = Object.freeze([
  { studentNumber: "SYNTH-0001", displayName: "Synthetic Student A", active: true, groupCodes: ["TEST-GROUP-A"], activeEnrolmentCount: 1 },
  { studentNumber: "SYNTH-0002", displayName: "Synthetic Student B", active: true, groupCodes: ["TEST-GROUP-B"], activeEnrolmentCount: 1 },
]);

export const TEACHERS: readonly TeacherRecord[] = Object.freeze([
  { staffReference: "SYNTH-TEACHER-A", displayName: "Synthetic Teacher A", active: true, roleLabel: "platform admin" },
]);

export const GROUPS: readonly GroupRecord[] = Object.freeze([
  { groupCode: "TEST-GROUP-A", groupName: "Synthetic Test Group A", academicYear: "2026-27", yearGroup: "Year 1", courseKey: "t-level-digital-software-development", courseTitle: "T Level Digital Software Development", registrationOpen: true, active: true, activeLearnerCount: 1 },
  { groupCode: "TEST-GROUP-B", groupName: "Synthetic Test Group B", academicYear: "2026-27", yearGroup: "Year 2", courseKey: "t-level-digital-software-development", courseTitle: "T Level Digital Software Development", registrationOpen: false, active: true, activeLearnerCount: 1 },
]);

export const ENROLMENTS: readonly EnrolmentRecord[] = Object.freeze([
  { learnerNumber: "SYNTH-0001", groupCode: "TEST-GROUP-A", joinedOn: "2026-09-01", leftOn: null, status: "active" },
  { learnerNumber: "SYNTH-0002", groupCode: "TEST-GROUP-B", joinedOn: "2026-09-01", leftOn: null, status: "active" },
]);

export const ASSIGNMENTS: readonly AssignmentRecord[] = Object.freeze([
  { groupCode: "TEST-GROUP-A", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", opensAt: null, dueAt: null, required: true, active: true },
  { groupCode: "TEST-GROUP-B", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", opensAt: null, dueAt: null, required: true, active: true },
]);

export const ATTEMPTS: readonly AttemptRecord[] = Object.freeze([
  { attemptId: "demo-attempt-a", learnerNumber: "SYNTH-0001", groupCode: "TEST-GROUP-A", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", attemptNumber: 1, status: "completed", score: 8, maxScore: 10, markingSource: "server", evidenceLevel: "question_level", receivedAt: "2026-08-11T08:50:00Z", completedAt: "2026-08-11T09:00:00Z", requiresReview: false, questionCount: 2 },
  { attemptId: "demo-attempt-b", learnerNumber: "SYNTH-0002", groupCode: "TEST-GROUP-B", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", attemptNumber: 1, status: "completed", score: 6, maxScore: 10, markingSource: "server", evidenceLevel: "question_level", receivedAt: "2026-08-11T09:10:00Z", completedAt: "2026-08-11T09:20:00Z", requiresReview: true, questionCount: 2 },
]);

export const RESPONSES: readonly ResponseRecord[] = Object.freeze([
  {
    responseId: "demo-response-a1",
    attemptId: "demo-attempt-a",
    learnerNumber: "SYNTH-0001",
    groupCode: "TEST-GROUP-A",
    activityKey: "foundations-programming-diagnostic",
    questionKey: "q-choice",
    questionType: "single",
    sectionKey: "variables",
    sectionTitle: "Variables",
    ordinal: 1,
    topicKeys: ["variables"],
    skillKeys: ["identify"],
    responsePayload: { optionId: "b" },
    score: 1,
    maxScore: 1,
    isCorrect: true,
    requiresReview: false,
    markingSource: "server",
    markedAt: "2026-08-11T09:00:00Z",
    feedbackSummary: null,
    feedbackNextStep: null,
  },
  {
    responseId: "demo-response-b1",
    attemptId: "demo-attempt-b",
    learnerNumber: "SYNTH-0002",
    groupCode: "TEST-GROUP-B",
    activityKey: "foundations-programming-diagnostic",
    questionKey: "q-written",
    questionType: "text",
    sectionKey: "variables",
    sectionTitle: "Variables",
    ordinal: 2,
    topicKeys: ["variables"],
    skillKeys: ["explain"],
    responsePayload: { text: "A variable stores a value." },
    score: null,
    maxScore: 4,
    isCorrect: null,
    requiresReview: true,
    markingSource: "server",
    markedAt: "2026-08-11T09:20:00Z",
    feedbackSummary: null,
    feedbackNextStep: null,
  },
]);

export const ACTIVITY_PERFORMANCE: readonly ActivityPerformanceRecord[] = Object.freeze([
  { groupCode: "TEST-GROUP-A", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", completedAttempts: 1, learnerCount: 1, averageScorePercentage: 80, bestScorePercentage: 80, firstCompletedAt: "2026-08-11T09:00:00Z", latestCompletedAt: "2026-08-11T09:00:00Z" },
  { groupCode: "TEST-GROUP-B", activityKey: "foundations-programming-diagnostic", activityVersion: "2.0.0", completedAttempts: 1, learnerCount: 1, averageScorePercentage: 60, bestScorePercentage: 60, firstCompletedAt: "2026-08-11T09:20:00Z", latestCompletedAt: "2026-08-11T09:20:00Z" },
]);

export const ASSESSMENT_OVERVIEW = Object.freeze({
  activeLearners: 2,
  activeGroups: 2,
  attemptCount: 3,
  completedAttempts: 2,
  completionPercentage: 66.67,
  averageScorePercentage: 70,
  requiresReviewCount: 1,
  reviewedResponseCount: 0,
  assignmentCount: 2,
  participatingLearnerCount: 2,
  topicLinkCount: 4,
  skillLinkCount: 2,
});

export const GROUP_PERFORMANCE = Object.freeze([
  {
    groupCode: "TEST-GROUP-A",
    groupName: "Test Group A",
    courseKey: "ocr-level-3-it",
    activeLearnerCount: 1,
    participatingLearnerCount: 1,
    completedAttempts: 1,
    attemptCount: 1,
    averageScorePercentage: 80,
    bestScorePercentage: 80,
    latestScorePercentage: 80,
    requiresReviewCount: 0,
    reviewedResponseCount: 0,
    assignmentCount: 1,
  },
  {
    groupCode: "TEST-GROUP-B",
    groupName: "Test Group B",
    courseKey: "ocr-level-3-it",
    activeLearnerCount: 1,
    participatingLearnerCount: 1,
    completedAttempts: 1,
    attemptCount: 2,
    averageScorePercentage: 60,
    bestScorePercentage: 60,
    latestScorePercentage: 60,
    requiresReviewCount: 1,
    reviewedResponseCount: 0,
    assignmentCount: 1,
  },
]);

export const LEARNER_PERFORMANCE = Object.freeze([
  {
    learnerId: "learner-a",
    studentNumber: "SYNTH-0001",
    displayName: "Synthetic Learner A",
    groupCodes: ["TEST-GROUP-A"],
    assignedActivityCount: 1,
    completedActivityCount: 1,
    attemptCount: 1,
    completedAttempts: 1,
    averageScorePercentage: 80,
    bestScorePercentage: 80,
    latestScorePercentage: 80,
    firstScorePercentage: 80,
    requiresReviewCount: 0,
    reviewedResponseCount: 0,
    latestCompletedAt: "2026-08-11T09:00:00Z",
  },
  {
    learnerId: "learner-b",
    studentNumber: "SYNTH-0002",
    displayName: "Synthetic Learner B",
    groupCodes: ["TEST-GROUP-B"],
    assignedActivityCount: 1,
    completedActivityCount: 1,
    attemptCount: 2,
    completedAttempts: 1,
    averageScorePercentage: 60,
    bestScorePercentage: 60,
    latestScorePercentage: 55,
    firstScorePercentage: 60,
    requiresReviewCount: 1,
    reviewedResponseCount: 0,
    latestCompletedAt: "2026-08-11T09:20:00Z",
  },
]);

export const ACTIVITY_ANALYTICS = Object.freeze([
  {
    groupCode: "TEST-GROUP-A",
    courseKey: "ocr-level-3-it",
    activityKey: "foundations-programming-diagnostic",
    activityVersion: "2.0.0",
    assignedLearnerCount: 1,
    attemptedLearnerCount: 1,
    completedLearnerCount: 1,
    completionPercentage: 100,
    attemptCount: 1,
    completedAttempts: 1,
    averageScorePercentage: 80,
    bestScorePercentage: 80,
    latestScorePercentage: 80,
    requiresReviewCount: 0,
    reviewedResponseCount: 0,
    latestCompletedAt: "2026-08-11T09:00:00Z",
  },
  {
    groupCode: "TEST-GROUP-B",
    courseKey: "ocr-level-3-it",
    activityKey: "foundations-programming-diagnostic",
    activityVersion: "2.0.0",
    assignedLearnerCount: 1,
    attemptedLearnerCount: 0,
    completedLearnerCount: 0,
    completionPercentage: 0,
    attemptCount: 0,
    completedAttempts: 0,
    averageScorePercentage: null,
    bestScorePercentage: null,
    latestScorePercentage: null,
    requiresReviewCount: 1,
    reviewedResponseCount: 0,
    latestCompletedAt: null,
  },
]);

export const QUESTION_PERFORMANCE = Object.freeze([
  {
    activityKey: "foundations-programming-diagnostic",
    activityVersion: "2.0.0",
    questionKey: "q-networks-1",
    questionType: "single_choice",
    sectionKey: "section-1",
    topicKeys: ["networks"],
    skillKeys: ["analyse"],
    responseCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    requiresReviewCount: 0,
    reviewedResponseCount: 0,
    correctnessPercentage: 50,
    averageAwardedScore: 0.5,
    averageMaxScore: 1,
  },
]);

export const TOPIC_PERFORMANCE = Object.freeze([
  {
    topicKey: "networks",
    responseCount: 2,
    attemptCount: 2,
    learnerCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    requiresReviewCount: 0,
    successPercentage: 50,
    averageAwardedScore: 0.5,
  },
]);

export const SKILL_PERFORMANCE = Object.freeze([
  {
    skillKey: "analyse",
    responseCount: 2,
    attemptCount: 2,
    learnerCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    requiresReviewCount: 0,
    successPercentage: 50,
    averageAwardedScore: 0.5,
  },
]);

export const DASHBOARD_SUMMARY: DashboardSummaryRecord = Object.freeze({
  registeredHubs: 3,
  activeHubs: 3,
  activeLearners: 2,
  activeGroups: 2,
  activeEnrolments: 2,
  assignments: 2,
  recentAttempts: 2,
  completedAttempts: 2,
  averageScorePercentage: 70,
  healthyServices: 1,
  serviceCount: 2,
  activeContracts: 4,
  contractCount: 6,
});

export const AUDIT_EVENTS: readonly AuditEventRecord[] = Object.freeze([]);

const DEMO_STAFF_CONTEXT: CurrentStaffContextRecord = Object.freeze({
  teacherId: "demo-platform-admin",
  staffReference: "DEMO-ADMIN",
  displayName: "Platform Administrator",
  active: true,
  activeRoles: ["platform_admin"],
});

export const CURRICULUM_PUBLICATIONS: readonly CurriculumPublicationRecord[] = Object.freeze([
  {
    id: "demo-unit-14-publication",
    hubCode: "unit-14-software-engineering-for-business",
    courseKey: "ocr-level-3-it",
    packageVersion: "0.1.0",
    schemaVersion: "0.1.0",
    sourcePackageVersion: "0.1.0",
    status: "published",
    author: "Ada Author",
    reviewer: "Riley Reviewer",
    publicationNotes: "Synthetic catalogue row for hub health.",
    publishedBy: "DEMO-ADMIN",
    createdAt: "2026-08-13T00:00:00Z",
    publishedAt: "2026-08-13T00:01:00Z",
    contentHash: "b".repeat(64),
  },
]);

export const demoAdminService: AdminReadService = Object.freeze({
  async getCurrentStaffContext() { return DEMO_STAFF_CONTEXT; },
  async listHubs() { return HUBS; },
  async listHubCourseLinks() { return HUB_COURSE_LINKS; },
  async listCourses() { return COURSES; },
  async listContracts() { return CONTRACTS; },
  async listHealth() { return HEALTH; },
  async listLearners() { return LEARNERS; },
  async listTeachers() { return TEACHERS; },
  async listGroups() { return GROUPS; },
  async listEnrolments() { return ENROLMENTS; },
  async listAssignments() { return ASSIGNMENTS; },
  async listAttempts() { return ATTEMPTS; },
  async listResponses() { return RESPONSES; },
  async listActivityPerformance() { return ACTIVITY_PERFORMANCE; },
  async getAssessmentOverview() { return ASSESSMENT_OVERVIEW; },
  async listGroupPerformance() { return GROUP_PERFORMANCE; },
  async listLearnerPerformance() { return LEARNER_PERFORMANCE; },
  async listActivityAnalytics() { return ACTIVITY_ANALYTICS; },
  async listQuestionPerformance() { return QUESTION_PERFORMANCE; },
  async listTopicPerformance() { return TOPIC_PERFORMANCE; },
  async listSkillPerformance() { return SKILL_PERFORMANCE; },
  async getDashboardSummary() { return DASHBOARD_SUMMARY; },
  async listAuditEvents() { return AUDIT_EVENTS; },
  async listCurriculumPublications() { return CURRICULUM_PUBLICATIONS; },
  async listCurriculumDrafts() { return [] as readonly CurriculumDraftSummary[]; },
});

export const DEMO_ADMIN_DATA: AdminDataSnapshot = Object.freeze({
  hubs: HUBS,
  hubCourseLinks: HUB_COURSE_LINKS,
  courses: COURSES,
  contracts: CONTRACTS,
  health: HEALTH,
  learners: LEARNERS,
  teachers: TEACHERS,
  groups: GROUPS,
  enrolments: ENROLMENTS,
  assignments: ASSIGNMENTS,
  attempts: ATTEMPTS,
  responses: RESPONSES,
  activityPerformance: ACTIVITY_PERFORMANCE,
  assessmentOverview: ASSESSMENT_OVERVIEW,
  groupPerformance: GROUP_PERFORMANCE,
  learnerPerformance: LEARNER_PERFORMANCE,
  activityAnalytics: ACTIVITY_ANALYTICS,
  questionPerformance: QUESTION_PERFORMANCE,
  topicPerformance: TOPIC_PERFORMANCE,
  skillPerformance: SKILL_PERFORMANCE,
  dashboardSummary: DASHBOARD_SUMMARY,
  auditEvents: AUDIT_EVENTS,
  curriculumPublications: CURRICULUM_PUBLICATIONS,
  curriculumDrafts: [],
});

export const DEMO_DATA_NOTICE = Object.freeze({
  title: "Demo data",
  message:
    "Showing reviewed registry metadata and synthetic local fixtures. Set the explicit live environment mode to authenticate against admin_api.",
});
