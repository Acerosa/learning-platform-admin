export const ADMIN_API_CONTRACT = Object.freeze({
  schema: "admin_api",
  version: "0.2.0",
  status: "draft",
  mode: "read-models-with-hub-registration-curriculum-publication-and-teacher-review",
});

export const ADMIN_API_VIEWS = Object.freeze({
  currentStaffContext: "admin_api.current_staff_context",
  hubs: "admin_api.hubs",
  hubCourseLinks: "admin_api.hub_course_links",
  courses: "admin_api.courses",
  platformContracts: "admin_api.platform_contracts",
  staffRoles: "admin_api.staff_roles",
  auditEvents: "admin_api.audit_events",
  operationalHealth: "admin_api.operational_health",
  learners: "admin_api.learners",
  groups: "admin_api.groups",
  enrolments: "admin_api.enrolments",
  assignments: "admin_api.assignments",
  attempts: "admin_api.attempts",
  responses: "admin_api.responses",
  dashboardSummary: "admin_api.dashboard_summary",
  activityPerformance: "admin_api.activity_performance",
  assessmentOverview: "admin_api.assessment_overview",
  groupPerformance: "admin_api.group_performance",
  learnerPerformance: "admin_api.learner_performance",
  learnerActivityPerformance: "admin_api.learner_activity_performance",
  activityAnalytics: "admin_api.activity_analytics",
  questionPerformance: "admin_api.question_performance",
  questionGroupPerformance: "admin_api.question_group_performance",
  topicPerformance: "admin_api.topic_performance",
  skillPerformance: "admin_api.skill_performance",
  curriculumPublications: "admin_api.curriculum_publications",
  curriculumDrafts: "admin_api.curriculum_drafts",
  libraryQuestions: "admin_api.library_questions",
  libraryActivities: "admin_api.library_activities",
  libraryTemplates: "admin_api.library_templates",
  libraryResources: "admin_api.library_resources",
  libraryFeedback: "admin_api.library_feedback",
  libraryHints: "admin_api.library_hints",
  compositionReferences: "admin_api.composition_references",
  compositionTemplates: "admin_api.composition_templates",
  curriculumRecipes: "admin_api.curriculum_recipes",
  diagnosticSessions: "admin_api.diagnostic_sessions",
  diagnosticResponses: "admin_api.diagnostic_responses",
  diagnosticSummary: "admin_api.diagnostic_summary",
});

export const ADMIN_API_RPCS = Object.freeze({
  claimInitialPlatformAdmin: "admin_api.claim_initial_platform_admin",
  registerHub: "admin_api.register_hub",
  updateHub: "admin_api.update_hub",
  publishCurriculum: "admin_api.publish_curriculum",
  saveCurriculumDraft: "admin_api.save_curriculum_draft",
  getCurriculumDraft: "admin_api.get_curriculum_draft",
  discardCurriculumDraft: "admin_api.discard_curriculum_draft",
  currentCurriculumPackage: "admin_api.current_curriculum_package",
  reviewResponse: "admin_api.review_response",
  searchLibrary: "admin_api.search_library",
  saveLibraryQuestion: "admin_api.save_library_question",
  saveLibraryActivity: "admin_api.save_library_activity",
  deleteLibraryItem: "admin_api.delete_library_item",
  publishLibraryItem: "admin_api.publish_library_item",
  archiveLibraryItem: "admin_api.archive_library_item",
  duplicateLibraryItem: "admin_api.duplicate_library_item",
  getLibraryQuestionDetail: "admin_api.get_library_question_detail",
  saveCompositionReference: "admin_api.save_composition_reference",
  detachCompositionReference: "admin_api.detach_composition_reference",
  compositionUpdateCheck: "admin_api.composition_update_check",
  compositionImpactAnalysis: "admin_api.composition_impact_analysis",
  saveCompositionTemplate: "admin_api.save_composition_template",
  archiveCompositionTemplate: "admin_api.archive_composition_template",
  restoreCompositionTemplate: "admin_api.restore_composition_template",
  duplicateCompositionTemplate: "admin_api.duplicate_composition_template",
  listCompositionTemplates: "admin_api.list_composition_templates",
  saveCurriculumRecipe: "admin_api.save_curriculum_recipe",
  archiveCurriculumRecipe: "admin_api.archive_curriculum_recipe",
  restoreCurriculumRecipe: "admin_api.restore_curriculum_recipe",
  duplicateCurriculumRecipe: "admin_api.duplicate_curriculum_recipe",
  listCurriculumRecipes: "admin_api.list_curriculum_recipes",
  saveCompositionDraftState: "admin_api.save_composition_draft_state",
  getCompositionDraftState: "admin_api.get_composition_draft_state",
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

export interface CourseRecord {
  courseKey: string;
  courseTitle: string;
  code: string | null;
  qualificationLevel: string | null;
  active: boolean;
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
  requiresReview: boolean;
  questionCount: number | null;
}

export interface RecentAttemptRecord {
  attemptId: string;
  learnerNumber: string;
  activityKey: string;
  activityVersion: string;
  status: string;
  score: number;
  maxScore: number;
  completedAt: string;
}

export interface ResponseRecord {
  responseId: string;
  attemptId: string;
  learnerNumber: string;
  groupCode: string;
  activityKey: string;
  questionKey: string;
  questionType: string;
  sectionKey: string | null;
  sectionTitle: string | null;
  ordinal: number;
  topicKeys: readonly string[];
  skillKeys: readonly string[];
  responsePayload: Readonly<Record<string, unknown>>;
  score: number | null;
  maxScore: number;
  isCorrect: boolean | null;
  requiresReview: boolean;
  markingSource: string;
  markedAt: string;
  feedbackSummary: string | null;
  feedbackNextStep: string | null;
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

export interface AssessmentOverviewRecord {
  activeLearners: number;
  activeGroups: number;
  attemptCount: number;
  completedAttempts: number;
  completionPercentage: number | null;
  averageScorePercentage: number | null;
  requiresReviewCount: number;
  reviewedResponseCount: number;
  assignmentCount: number;
  participatingLearnerCount: number;
  topicLinkCount: number;
  skillLinkCount: number;
}

export interface GroupPerformanceRecord {
  groupCode: string;
  groupName: string;
  courseKey: string;
  courseTitle?: string | null;
  activeLearnerCount: number;
  participatingLearnerCount: number;
  completedAttempts: number;
  attemptCount: number;
  averageScorePercentage: number | null;
  bestScorePercentage: number | null;
  latestScorePercentage: number | null;
  requiresReviewCount: number;
  reviewedResponseCount: number;
  assignmentCount: number;
}

export interface LearnerPerformanceRecord {
  learnerId: string;
  studentNumber: string;
  displayName: string;
  groupCodes: readonly string[];
  assignedActivityCount: number;
  completedActivityCount: number;
  attemptCount: number;
  completedAttempts: number;
  averageScorePercentage: number | null;
  bestScorePercentage: number | null;
  latestScorePercentage: number | null;
  firstScorePercentage: number | null;
  requiresReviewCount: number;
  reviewedResponseCount: number;
  latestCompletedAt: string | null;
}

export interface ActivityAnalyticsRecord {
  groupCode: string;
  groupName?: string | null;
  courseKey: string;
  courseTitle?: string | null;
  assignmentId?: string | null;
  activityId?: string | null;
  activityKey: string;
  activityTitle?: string | null;
  activityVersion: string;
  assignedLearnerCount: number;
  attemptedLearnerCount: number;
  completedLearnerCount: number;
  completionPercentage: number | null;
  participationPercentage?: number | null;
  attemptCount: number;
  completedAttempts: number;
  averageScorePercentage: number | null;
  bestScorePercentage: number | null;
  latestScorePercentage: number | null;
  requiresReviewCount: number;
  reviewedResponseCount: number;
  latestCompletedAt: string | null;
}

export interface LearnerActivityPerformanceRecord {
  learnerId: string;
  studentNumber: string;
  displayName: string;
  courseId: string;
  courseKey: string;
  courseTitle: string;
  groupId: string;
  groupCode: string;
  groupName: string;
  assignmentId: string;
  activityId: string;
  activityKey: string;
  activityTitle: string;
  activityVersion: string;
  hubCodes: readonly string[];
  hubNames: readonly string[];
  weekNumber: number | null;
  weekTitle: string | null;
  attemptCount: number;
  completedAttemptCount: number;
  firstScorePercentage: number | null;
  latestScorePercentage: number | null;
  bestScorePercentage: number | null;
  averageScorePercentage: number | null;
  firstCompletedAt: string | null;
  latestCompletedAt: string | null;
  requiresReviewCount: number;
  reviewedResponseCount: number;
}

export interface QuestionGroupPerformanceRecord {
  groupCode: string;
  groupName: string;
  courseKey: string;
  courseTitle: string;
  assignmentId: string;
  activityKey: string;
  activityTitle: string;
  activityVersion: string;
  questionKey: string;
  questionTitle: string;
  questionType: string;
  sectionKey: string | null;
  ordinal: number;
  topicKeys: readonly string[];
  skillKeys: readonly string[];
  responseCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  requiresReviewCount: number;
  reviewedResponseCount: number;
  correctnessPercentage: number | null;
  averageAwardedScore: number | null;
  averageMaxScore: number | null;
}

export interface QuestionPerformanceRecord {
  activityKey: string;
  activityVersion: string;
  questionKey: string;
  questionType: string;
  sectionKey: string | null;
  topicKeys: readonly string[];
  skillKeys: readonly string[];
  responseCount: number;
  correctCount: number;
  incorrectCount: number;
  requiresReviewCount: number;
  reviewedResponseCount: number;
  correctnessPercentage: number | null;
  averageAwardedScore: number | null;
  averageMaxScore: number | null;
}

export interface TopicPerformanceRecord {
  topicKey: string;
  responseCount: number;
  attemptCount: number;
  learnerCount: number;
  correctCount: number;
  incorrectCount: number;
  requiresReviewCount: number;
  successPercentage: number | null;
  averageAwardedScore: number | null;
}

export interface SkillPerformanceRecord {
  skillKey: string;
  responseCount: number;
  attemptCount: number;
  learnerCount: number;
  correctCount: number;
  incorrectCount: number;
  requiresReviewCount: number;
  successPercentage: number | null;
  averageAwardedScore: number | null;
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

export interface CurriculumDraftSaveResult {
  id: string;
  hubCode: string;
  courseKey: string;
  title: string;
  lifecycleStatus: string;
  revision: number;
  basedOnPackageVersion: string | null;
  updatedAt: string;
}

export interface CurriculumDraftSummary {
  id: string;
  hubCode: string;
  courseKey: string;
  title: string;
  lifecycleStatus: string;
  revision: number;
  basedOnPackageVersion: string | null;
  updatedAt: string;
}

export interface CurriculumDraftRecord extends CurriculumDraftSummary {
  package: Record<string, unknown>;
}

export interface CurrentCurriculumPackageRecord {
  id: string;
  hubCode: string;
  courseKey: string;
  packageVersion: string;
  schemaVersion: string;
  sourcePackageVersion: string;
  status: string;
  package: Record<string, unknown>;
  contentHash: string;
  publishedAt: string;
}

export interface HubRegistrationResult {
  hubCode: string;
  hubName: string;
  description: string;
  hubVersion: string;
  manifestVersion: string;
  coreVersion: string;
  learnerApiVersion: string;
  submissionContractVersion: string;
  platformVersion: string;
  repositoryUrl: string;
  deploymentUrl: string | null;
  activityTypes: readonly string[];
  evidenceCapabilities: readonly string[];
  features: Readonly<Record<string, boolean>>;
  compatibility: Readonly<Record<string, unknown>>;
  status: HubLifecycle;
  active: boolean;
  courseKeys: readonly string[];
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

export type DiagnosticSessionStatus = "started" | "completed" | "abandoned";

export interface DiagnosticSessionRecord {
  sessionId: string;
  studentName: string;
  studentId: string;
  hubCode: string;
  hubName: string;
  courseKey: string;
  courseTitle: string;
  status: DiagnosticSessionStatus;
  startedAt: string;
  completedAt: string | null;
  responseCount: number;
  notSureCount: number;
}

export interface DiagnosticResponseRecord {
  responseId: string;
  sessionId: string;
  studentName: string;
  studentId: string;
  hubCode: string;
  courseKey: string;
  activityId: string;
  unitKey: string;
  topicKey: string | null;
  questionKey: string;
  evidence: unknown;
  isNotSure: boolean;
  confidence: string | null;
  isCorrect: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticSummaryRecord {
  hubCode: string;
  courseKey: string;
  startedCount: number;
  completedCount: number;
  completionPercentage: number | null;
  responseCount: number;
  notSureCount: number;
  notSurePercentage: number | null;
}

export interface ReviewResponseRequest {
  responseId: string;
  awardedScore: number;
  isCorrect: boolean | null;
  feedbackSummary: string;
  feedbackNextStep?: string | null;
}

export interface ReviewResponseResult {
  responseId: string;
  attemptId: string;
  awardedScore: number;
  maxScore: number;
  isCorrect: boolean | null;
  requiresReview: boolean;
  markingSource: string;
  feedbackSummary: string | null;
  feedbackNextStep: string | null;
  markedAt: string;
  attemptScore: number;
  attemptMarkingSource: string;
  idempotent: boolean;
}

export interface AdminDataSnapshot {
  hubs: readonly HubRecord[];
  hubCourseLinks: readonly HubCourseLinkRecord[];
  courses: readonly CourseRecord[];
  contracts: readonly PlatformContractRecord[];
  health: readonly HealthRecord[];
  learners: readonly LearnerRecord[];
  teachers: readonly TeacherRecord[];
  groups: readonly GroupRecord[];
  enrolments: readonly EnrolmentRecord[];
  assignments: readonly AssignmentRecord[];
  attempts: readonly AttemptRecord[];
  responses: readonly ResponseRecord[];
  activityPerformance: readonly ActivityPerformanceRecord[];
  assessmentOverview: AssessmentOverviewRecord | null;
  groupPerformance: readonly GroupPerformanceRecord[];
  learnerPerformance: readonly LearnerPerformanceRecord[];
  learnerActivityPerformance: readonly LearnerActivityPerformanceRecord[];
  activityAnalytics: readonly ActivityAnalyticsRecord[];
  questionPerformance: readonly QuestionPerformanceRecord[];
  questionGroupPerformance: readonly QuestionGroupPerformanceRecord[];
  topicPerformance: readonly TopicPerformanceRecord[];
  skillPerformance: readonly SkillPerformanceRecord[];
  dashboardSummary: DashboardSummaryRecord;
  auditEvents: readonly AuditEventRecord[];
  curriculumPublications: readonly CurriculumPublicationRecord[];
  curriculumDrafts: readonly CurriculumDraftSummary[];
  diagnosticSessions: readonly DiagnosticSessionRecord[];
  diagnosticResponses: readonly DiagnosticResponseRecord[];
  diagnosticSummary: readonly DiagnosticSummaryRecord[];
}

export interface AdminReadService {
  getCurrentStaffContext(): Promise<CurrentStaffContextRecord | null>;
  listHubs(): Promise<readonly HubRecord[]>;
  listHubCourseLinks(): Promise<readonly HubCourseLinkRecord[]>;
  listCourses(): Promise<readonly CourseRecord[]>;
  listContracts(): Promise<readonly PlatformContractRecord[]>;
  listHealth(): Promise<readonly HealthRecord[]>;
  listTeachers(): Promise<readonly TeacherRecord[]>;
  listLearners(): Promise<readonly LearnerRecord[]>;
  listGroups(): Promise<readonly GroupRecord[]>;
  listEnrolments(): Promise<readonly EnrolmentRecord[]>;
  listAssignments(): Promise<readonly AssignmentRecord[]>;
  listAttempts(): Promise<readonly AttemptRecord[]>;
  listRecentAttempts(): Promise<readonly RecentAttemptRecord[]>;
  listResponses(): Promise<readonly ResponseRecord[]>;
  listActivityPerformance(): Promise<readonly ActivityPerformanceRecord[]>;
  getAssessmentOverview(): Promise<AssessmentOverviewRecord | null>;
  listGroupPerformance(): Promise<readonly GroupPerformanceRecord[]>;
  listLearnerPerformance(): Promise<readonly LearnerPerformanceRecord[]>;
  listLearnerActivityPerformance(): Promise<readonly LearnerActivityPerformanceRecord[]>;
  listActivityAnalytics(): Promise<readonly ActivityAnalyticsRecord[]>;
  listQuestionPerformance(): Promise<readonly QuestionPerformanceRecord[]>;
  listQuestionGroupPerformance(): Promise<readonly QuestionGroupPerformanceRecord[]>;
  listTopicPerformance(): Promise<readonly TopicPerformanceRecord[]>;
  listSkillPerformance(): Promise<readonly SkillPerformanceRecord[]>;
  getDashboardSummary(): Promise<DashboardSummaryRecord>;
  listAuditEvents(): Promise<readonly AuditEventRecord[]>;
  listCurriculumPublications(): Promise<readonly CurriculumPublicationRecord[]>;
  listCurriculumDrafts(): Promise<readonly CurriculumDraftSummary[]>;
  listDiagnosticSessions(): Promise<readonly DiagnosticSessionRecord[]>;
  listDiagnosticResponses(): Promise<readonly DiagnosticResponseRecord[]>;
  listDiagnosticSummary(): Promise<readonly DiagnosticSummaryRecord[]>;
}

export interface AdminMutationService {
  readonly status: "pending-backend-contract";
  registerHub(input: unknown): Promise<HubRegistrationResult>;
  updateHub(hubCode: string, input: unknown): Promise<HubRegistrationResult>;
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
    "Hub registration uses admin_api.register_hub and admin_api.update_hub. Other administrative mutation RPCs remain unspecified.",
  requiredBeforeEnablement: [
    "role and permission requirement",
    "validated transactional RPC",
    "stable conflict and error behaviour",
    "audit event",
    "RLS and integration tests",
  ],
});
