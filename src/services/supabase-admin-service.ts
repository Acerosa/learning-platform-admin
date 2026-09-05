import { createClient } from "@supabase/supabase-js";
import type {
  ActivityAnalyticsRecord,
  ActivityPerformanceRecord,
  AdminDataSnapshot,
  AdminReadService,
  AssessmentOverviewRecord,
  AssignmentRecord,
  AttemptRecord,
  RecentAttemptRecord,
  AuditEventRecord,
  CurrentStaffContextRecord,
  CourseRecord,
  CurriculumDraftRecord,
  CurriculumDraftSummary,
  CurriculumPublicationRecord,
  DashboardSummaryRecord,
  EnrolmentRecord,
  GroupPerformanceRecord,
  GroupRecord,
  HealthRecord,
  HubCourseLinkRecord,
  HubLifecycle,
  HubRecord,
  LearnerActivityPerformanceRecord,
  LearnerPerformanceRecord,
  LearnerRecord,
  PlatformContractRecord,
  HubRegistrationResult,
  PlatformPublicationResult,
  CurriculumDraftSaveResult,
  CurrentCurriculumPackageRecord,
  QuestionGroupPerformanceRecord,
  QuestionPerformanceRecord,
  ResponseRecord,
  ReviewResponseRequest,
  ReviewResponseResult,
  SkillPerformanceRecord,
  TeacherRecord,
  TopicPerformanceRecord,
  DiagnosticSessionRecord,
  DiagnosticResponseRecord,
  DiagnosticSummaryRecord,
} from "../api/admin-api";
import type { HubRegistrationRequest } from "../content/hub-registration.ts";
import { platformPublicationArgs } from "../content/platform-publication.ts";
import type { AuthoringDraft } from "../content/types.ts";
import type { AdminRuntimeConfig } from "./admin-runtime-config";

type AdminRow = Readonly<Record<string, unknown>>;

export class AdminReadError extends Error {
  readonly code: "access-denied" | "unavailable" | "invalid-response";

  constructor(code: AdminReadError["code"], resource: string) {
    super(`The ${resource} read could not be completed.`);
    this.name = "AdminReadError";
    this.code = code;
  }
}

export class AdminAuthError extends Error {
  readonly code: "registration-failed" | "bootstrap-failed";

  constructor(code: AdminAuthError["code"]) {
    super(
      code === "registration-failed"
        ? "The administrator account could not be created."
        : "Initial administrator setup could not be completed.",
    );
    this.name = "AdminAuthError";
    this.code = code;
  }
}

const REGISTRATION_ERROR_MESSAGES: Record<string, string> = {
  unavailable: "Hub registration requires a live administrator session.",
  AUTHENTICATION_REQUIRED: "Sign in with an authorised administrator account to register a hub.",
  HUB_REGISTRATION_NOT_AUTHORISED: "This account is not authorised to register or update hubs.",
  HUB_MANIFEST_INVALID: "The hub manifest is incomplete or does not match the LHDS contract.",
  HUB_INVALID_URL: "Repository and site URLs must be canonical HTTPS addresses.",
  HUB_STATUS_INVALID: "Choose a supported hub lifecycle status.",
  HUB_ACTIVE_STATUS_INVALID: "Only testing, production or maintenance hubs can be registered as active.",
  HUB_MANIFEST_VERSION_UNSUPPORTED: "The backend does not accept this hub manifest version.",
  HUB_CORE_VERSION_UNSUPPORTED: "The backend does not accept this core version.",
  HUB_LEARNER_API_VERSION_UNSUPPORTED: "The backend does not accept this learner API version.",
  HUB_SUBMISSION_VERSION_UNSUPPORTED: "The backend does not accept this submission contract version.",
  HUB_COURSE_NOT_FOUND: "A declared course is not registered in the platform catalogue.",
  HUB_COURSE_INACTIVE: "A declared course exists but is inactive.",
  HUB_CODE_MISMATCH: "The hub code cannot be changed after registration.",
  HUB_NOT_FOUND: "That hub is not registered in the platform catalogue.",
  HUB_DUPLICATE_CODE: "A hub with this code is already registered.",
  HUB_DUPLICATE_REPOSITORY: "A hub with this repository URL is already registered.",
  HUB_DUPLICATE_DEPLOYMENT: "A hub with this site URL is already registered.",
  "registration-failed": "The hub could not be registered.",
};

export class AdminHubRegistrationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(REGISTRATION_ERROR_MESSAGES[code] ?? REGISTRATION_ERROR_MESSAGES["registration-failed"]);
    this.name = "AdminHubRegistrationError";
    this.code = code;
  }
}

function registrationErrorCode(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return Object.keys(REGISTRATION_ERROR_MESSAGES)
    .filter((code) => code !== "unavailable" && code !== "registration-failed")
    .sort((left, right) => right.length - left.length)
    .find((code) => message.includes(code))
    ?? "registration-failed";
}

const PUBLICATION_ERROR_MESSAGES: Record<string, string> = {
  unavailable: "Platform publication requires a live administrator session.",
  AUTHENTICATION_REQUIRED: "Sign in with an authorised administrator account to publish curriculum.",
  PUBLICATION_NOT_AUTHORISED: "This account is not authorised to publish curriculum to the platform.",
  PUBLICATION_STATUS_INVALID: "Only Approved or Published snapshots can be sent to the platform.",
  PUBLICATION_VALIDATION_FAILED: "The backend rejected the package during validation.",
  UNSUPPORTED_SCHEMA_VERSION: "The backend does not accept this schema version.",
  UNSUPPORTED_PACKAGE_VERSION: "The backend does not accept this content package version.",
  PUBLICATION_CONTEXT_MISMATCH: "The snapshot hub and course do not match the selected curriculum.",
  HUB_NOT_FOUND: "The selected hub is not registered in the platform catalogue.",
  COURSE_NOT_FOUND: "The selected course is not linked to that hub.",
  DUPLICATE_VERSION: "That version is already published with different content.",
  PUBLICATION_VERSION_REGRESSION: "The new version must be greater than the latest published version.",
  PUBLICATION_NOT_FOUND: "No published curriculum exists for that hub and course.",
  DRAFT_REVISION_CONFLICT: "This draft was saved elsewhere. Reload before overwriting.",
  DRAFT_NOT_FOUND: "That curriculum draft could not be found.",
  CURRICULUM_AUTHORING_NOT_AUTHORISED: "This account is not authorised to author curriculum.",
  DRAFT_PAYLOAD_INVALID: "The draft payload is incomplete.",
  DRAFT_STATUS_INVALID: "That draft status is not allowed.",
  PUBLISHED_CURRICULUM_IMMUTABLE: "Published platform records cannot be edited.",
  "publication-failed": "Curriculum could not be published to the platform.",
};

export class AdminPublicationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(PUBLICATION_ERROR_MESSAGES[code] ?? PUBLICATION_ERROR_MESSAGES["publication-failed"]);
    this.name = "AdminPublicationError";
    this.code = code;
  }
}

function publicationErrorCode(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return Object.keys(PUBLICATION_ERROR_MESSAGES).find((code) => message.includes(code))
    ?? "publication-failed";
}

const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  unavailable: "Teacher review requires a live administrator session.",
  AUTHENTICATION_REQUIRED: "Sign in with an authorised staff account to review responses.",
  REVIEW_NOT_AUTHORISED: "This account is not authorised to review that learner response.",
  REVIEW_RESPONSE_REQUIRED: "Select a response to review.",
  REVIEW_RESPONSE_NOT_FOUND: "That response could not be found.",
  REVIEW_ATTEMPT_NOT_FOUND: "The attempt for that response could not be found.",
  REVIEW_SCORE_INVALID: "Enter a score between 0 and the question maximum.",
  REVIEW_FEEDBACK_REQUIRED: "Enter feedback before completing the review.",
  REVIEW_FEEDBACK_TOO_LONG: "Feedback must be 2000 characters or fewer.",
  REVIEW_NEXT_STEP_TOO_LONG: "Next step must be 500 characters or fewer.",
  "review-failed": "The review could not be saved.",
};

export class AdminReviewError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(REVIEW_ERROR_MESSAGES[code] ?? REVIEW_ERROR_MESSAGES["review-failed"]);
    this.name = "AdminReviewError";
    this.code = code;
  }
}

function reviewErrorCode(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return Object.keys(REVIEW_ERROR_MESSAGES).find((code) => message.includes(code))
    ?? "review-failed";
}

export function registrationValidationMessage(
  password: string,
  confirmPassword: string,
) {
  return password === confirmPassword ? null : "Passwords must match.";
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableBoolean(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function jsonUnknown(value: unknown): unknown {
  return value === undefined ? null : value;
}

function booleanValue(value: unknown) {
  return value === true;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function objectValue(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function featureFlags(value: unknown) {
  return Object.fromEntries(
    Object.entries(objectValue(value)).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

function labelForKey(key: string) {
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function certificationState(manifestValue: unknown) {
  const manifest = objectValue(manifestValue);
  const certification = objectValue(manifest.certification);
  return nullableText(certification.status);
}

function mapHub(row: AdminRow): HubRecord {
  return {
    hubCode: textValue(row.hub_code),
    hubName: textValue(row.hub_name),
    description: textValue(row.description),
    hubVersion: textValue(row.hub_version),
    manifestVersion: textValue(row.manifest_version),
    coreVersion: textValue(row.core_version),
    learnerApiVersion: textValue(row.learner_api_version),
    submissionContractVersion: textValue(row.submission_contract_version),
    platformVersion: textValue(row.platform_version),
    subject: nullableText(row.subject),
    repositoryUrl: textValue(row.repository_url),
    deploymentUrl: nullableText(row.deployment_url),
    curriculumModel: nullableText(row.curriculum_model),
    activityTypes: stringArray(row.activity_types),
    evidenceCapabilities: stringArray(row.evidence_capabilities),
    features: featureFlags(row.features),
    compatibility: objectValue(row.compatibility),
    status: textValue(row.status) as HubLifecycle,
    active: booleanValue(row.active),
    certificationState: certificationState(row.manifest),
  };
}

function mapDashboard(row: AdminRow): DashboardSummaryRecord {
  return {
    registeredHubs: numberValue(row.registered_hubs),
    activeHubs: numberValue(row.active_hubs),
    activeLearners: numberValue(row.active_learners),
    activeGroups: numberValue(row.active_groups),
    activeEnrolments: numberValue(row.active_enrolments),
    assignments: numberValue(row.assignments),
    recentAttempts: numberValue(row.recent_attempts),
    completedAttempts: numberValue(row.completed_attempts),
    averageScorePercentage: nullableNumber(row.average_score_percentage),
    healthyServices: numberValue(row.healthy_services),
    serviceCount: numberValue(row.service_count),
    activeContracts: numberValue(row.active_contracts),
    contractCount: numberValue(row.contract_count),
  };
}

function errorCode(error: { code?: string } | null) {
  return error?.code === "42501" ? "access-denied" : "unavailable";
}

export function createSupabaseAdminClient(config: AdminRuntimeConfig) {
  if (
    config.mode !== "live" ||
    !config.valid ||
    !config.supabaseUrl ||
    !config.supabasePublishableKey
  ) {
    throw new Error("A valid live admin runtime configuration is required.");
  }

  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    db: { schema: "admin_api" },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}

export type AdminSupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export async function registerAdminAccount(
  client: AdminSupabaseClient,
  email: string,
  password: string,
  emailRedirectTo: string,
) {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) throw new AdminAuthError("registration-failed");

  return Object.freeze({
    confirmationRequired: !data.session,
    sessionAvailable: Boolean(data.session),
  });
}

export async function claimInitialPlatformAdmin(
  client: AdminSupabaseClient,
  bootstrapToken: string,
) {
  const { data, error } = await client
    .schema("admin_api")
    .rpc("claim_initial_platform_admin", {
      p_bootstrap_token: bootstrapToken,
    });

  if (error || !Array.isArray(data) || !data[0]) {
    throw new AdminAuthError("bootstrap-failed");
  }
}

export async function registerHub(
  client: AdminSupabaseClient,
  request: HubRegistrationRequest,
): Promise<HubRegistrationResult> {
  return mutateRegisteredHub(client, "register_hub", {
    p_manifest: request.manifest,
    p_status: request.status,
    p_active: request.active,
  });
}

export async function updateHub(
  client: AdminSupabaseClient,
  request: HubRegistrationRequest,
): Promise<HubRegistrationResult> {
  return mutateRegisteredHub(client, "update_hub", {
    p_hub_code: request.manifest.hubId,
    p_manifest: request.manifest,
    p_status: request.status,
    p_active: request.active,
  });
}

async function mutateRegisteredHub(
  client: AdminSupabaseClient,
  name: "register_hub" | "update_hub",
  parameters: Record<string, unknown>,
): Promise<HubRegistrationResult> {
  const { data, error } = await client
    .schema("admin_api")
    .rpc(name, parameters);

  if (error || !Array.isArray(data) || !data[0]) {
    throw new AdminHubRegistrationError(registrationErrorCode(error));
  }

  const row = data[0] as AdminRow;
  return {
    hubCode: textValue(row.hub_code),
    hubName: textValue(row.hub_name),
    description: textValue(row.description),
    hubVersion: textValue(row.hub_version),
    manifestVersion: textValue(row.manifest_version),
    coreVersion: textValue(row.core_version),
    learnerApiVersion: textValue(row.learner_api_version),
    submissionContractVersion: textValue(row.submission_contract_version),
    platformVersion: textValue(row.platform_version),
    repositoryUrl: textValue(row.repository_url),
    deploymentUrl: nullableText(row.deployment_url),
    activityTypes: stringArray(row.activity_types),
    evidenceCapabilities: stringArray(row.evidence_capabilities),
    features: featureFlags(row.features),
    compatibility: objectValue(row.compatibility),
    status: textValue(row.status) as HubLifecycle,
    active: booleanValue(row.active),
    courseKeys: stringArray(row.course_keys),
  };
}

export async function publishCurriculum(
  client: AdminSupabaseClient,
  record: AuthoringDraft,
): Promise<PlatformPublicationResult> {
  const { data, error } = await client
    .schema("admin_api")
    .rpc("publish_curriculum", platformPublicationArgs(record));

  if (error || !Array.isArray(data) || !data[0]) {
    throw new AdminPublicationError(publicationErrorCode(error));
  }

  const row = data[0] as AdminRow;
  return {
    id: textValue(row.id),
    hubCode: textValue(row.hub_code),
    courseKey: textValue(row.course_key),
    packageVersion: textValue(row.package_version),
    status: textValue(row.status),
    publishedAt: textValue(row.published_at),
    idempotent: booleanValue(row.idempotent),
  };
}

export async function saveCurriculumDraft(
  client: AdminSupabaseClient,
  record: AuthoringDraft,
): Promise<CurriculumDraftSaveResult> {
  const { data, error } = await client
    .schema("admin_api")
    .rpc("save_curriculum_draft", {
      p_draft_id: record.id,
      p_hub_code: record.hubId,
      p_course_key: record.courseKey,
      p_title: record.title,
      p_lifecycle_status: record.status === "published" ? "approved" : record.status,
      p_expected_revision: record.remoteRevision || 0,
      p_package: record.package,
      p_based_on_package_version: record.basedOnVersion,
    });

  if (error || !Array.isArray(data) || !data[0]) {
    throw new AdminPublicationError(publicationErrorCode(error));
  }
  const row = data[0] as AdminRow;
  return {
    id: textValue(row.id),
    hubCode: textValue(row.hub_code),
    courseKey: textValue(row.course_key),
    title: textValue(row.title),
    lifecycleStatus: textValue(row.lifecycle_status),
    revision: Number(row.revision || 0),
    basedOnPackageVersion: row.based_on_package_version ? textValue(row.based_on_package_version) : null,
    updatedAt: textValue(row.updated_at),
  };
}

export async function loadCurrentCurriculumPackage(
  client: AdminSupabaseClient,
  hubCode: string,
  courseKey: string,
): Promise<CurrentCurriculumPackageRecord> {
  const { data, error } = await client
    .schema("admin_api")
    .rpc("current_curriculum_package", {
      p_hub_code: hubCode,
      p_course_key: courseKey,
    });

  if (error || !Array.isArray(data) || !data[0]) {
    throw new AdminPublicationError(publicationErrorCode(error));
  }
  const row = data[0] as AdminRow;
  return {
    id: textValue(row.id),
    hubCode: textValue(row.hub_code),
    courseKey: textValue(row.course_key),
    packageVersion: textValue(row.package_version),
    schemaVersion: textValue(row.schema_version),
    sourcePackageVersion: textValue(row.source_package_version),
    status: textValue(row.status),
    package: (row.package && typeof row.package === "object" ? row.package : {}) as Record<string, unknown>,
    contentHash: textValue(row.content_hash),
    publishedAt: textValue(row.published_at),
  };
}

export async function getCurriculumDraft(
  client: AdminSupabaseClient,
  draftId: string,
): Promise<CurriculumDraftRecord> {
  const { data, error } = await client
    .schema("admin_api")
    .rpc("get_curriculum_draft", { p_draft_id: draftId });

  if (error || !Array.isArray(data) || !data[0]) {
    throw new AdminPublicationError(publicationErrorCode(error));
  }
  const row = data[0] as AdminRow;
  return {
    id: textValue(row.id),
    hubCode: textValue(row.hub_code),
    courseKey: textValue(row.course_key),
    title: textValue(row.title),
    lifecycleStatus: textValue(row.lifecycle_status),
    revision: Number(row.revision || 0),
    package: (row.package && typeof row.package === "object" ? row.package : {}) as Record<string, unknown>,
    basedOnPackageVersion: row.based_on_package_version ? textValue(row.based_on_package_version) : null,
    updatedAt: textValue(row.updated_at),
  };
}

export async function discardCurriculumDraft(
  client: AdminSupabaseClient,
  draftId: string,
): Promise<void> {
  const { error } = await client
    .schema("admin_api")
    .rpc("discard_curriculum_draft", { p_draft_id: draftId });
  if (error) {
    throw new AdminPublicationError(publicationErrorCode(error));
  }
}

export async function reviewResponse(
  client: AdminSupabaseClient,
  request: ReviewResponseRequest,
): Promise<ReviewResponseResult> {
  const { data, error } = await client
    .schema("admin_api")
    .rpc("review_response", {
      p_response_id: request.responseId,
      p_awarded_score: request.awardedScore,
      p_is_correct: request.isCorrect,
      p_feedback_summary: request.feedbackSummary,
      p_feedback_next_step: request.feedbackNextStep ?? null,
    });

  if (error || !Array.isArray(data) || !data[0]) {
    throw new AdminReviewError(reviewErrorCode(error));
  }

  const row = data[0] as AdminRow;
  return {
    responseId: textValue(row.response_id),
    attemptId: textValue(row.attempt_id),
    awardedScore: numberValue(row.awarded_score),
    maxScore: numberValue(row.max_score),
    isCorrect: row.is_correct === null ? null : booleanValue(row.is_correct),
    requiresReview: booleanValue(row.requires_review),
    markingSource: textValue(row.marking_source),
    feedbackSummary: nullableText(row.feedback_summary),
    feedbackNextStep: nullableText(row.feedback_next_step),
    markedAt: textValue(row.marked_at),
    attemptScore: numberValue(row.attempt_score),
    attemptMarkingSource: textValue(row.attempt_marking_source),
    idempotent: booleanValue(row.idempotent),
  };
}

export const ADMIN_READ_PAGE_SIZE = 1000;

export type AdminReadOrder = {
  column: string;
  ascending?: boolean;
};

function orderSpecs(order?: AdminReadOrder | readonly AdminReadOrder[]) {
  if (!order) return [];
  return Array.isArray(order) ? order : [order];
}

export function createSupabaseAdminReadService(
  client: AdminSupabaseClient,
): AdminReadService {
  function applyOrder<T extends { order: (column: string, options?: { ascending?: boolean }) => T }>(
    query: T,
    order?: AdminReadOrder | readonly AdminReadOrder[],
  ) {
    let next = query;
    for (const spec of orderSpecs(order)) {
      next = next.order(spec.column, { ascending: spec.ascending ?? true });
    }
    return next;
  }

  async function rows(
    view: string,
    columns: string,
    order?: AdminReadOrder | readonly AdminReadOrder[],
  ): Promise<readonly AdminRow[]> {
    const query = applyOrder(client.schema("admin_api").from(view).select(columns), order);
    const { data, error } = await query;
    if (error) throw new AdminReadError(errorCode(error), view);
    if (!Array.isArray(data)) throw new AdminReadError("invalid-response", view);
    return data as unknown as readonly AdminRow[];
  }

  async function pagedRows(
    view: string,
    columns: string,
    order: AdminReadOrder | readonly AdminReadOrder[],
  ): Promise<readonly AdminRow[]> {
    const collected: AdminRow[] = [];
    let from = 0;
    for (;;) {
      const to = from + ADMIN_READ_PAGE_SIZE - 1;
      const query = applyOrder(client.schema("admin_api").from(view).select(columns), order);
      const { data, error } = await query.range(from, to);
      if (error) throw new AdminReadError(errorCode(error), view);
      if (!Array.isArray(data)) throw new AdminReadError("invalid-response", view);
      collected.push(...(data as unknown as AdminRow[]));
      if (data.length < ADMIN_READ_PAGE_SIZE) break;
      from += ADMIN_READ_PAGE_SIZE;
    }
    return collected;
  }

  return Object.freeze({
    async getCurrentStaffContext() {
      const data = await rows(
        "current_staff_context",
        "teacher_id,staff_reference,display_name,active,active_roles",
      );
      const row = data[0];
      if (!row) return null;
      return {
        teacherId: textValue(row.teacher_id),
        staffReference: textValue(row.staff_reference),
        displayName: textValue(row.display_name),
        active: booleanValue(row.active),
        activeRoles: stringArray(row.active_roles),
      } satisfies CurrentStaffContextRecord;
    },

    async listHubs() {
      const data = await rows(
        "hubs",
        "hub_code,hub_name,description,hub_version,manifest_version,core_version,learner_api_version,submission_contract_version,platform_version,subject,repository_url,deployment_url,curriculum_model,activity_types,evidence_capabilities,features,compatibility,status,active,manifest",
        { column: "hub_name" },
      );
      return data.map(mapHub);
    },

    async listHubCourseLinks() {
      const data = await rows(
        "hub_course_links",
        "hub_code,course_key,course_title,active,linked_at",
        { column: "course_title" },
      );
      return data.map((row): HubCourseLinkRecord => ({
        hubCode: textValue(row.hub_code),
        courseKey: textValue(row.course_key),
        courseTitle: textValue(row.course_title),
        active: booleanValue(row.active),
        linkedAt: textValue(row.linked_at),
      }));
    },

    async listCourses() {
      const data = await rows(
        "courses",
        "course_key,course_title,code,qualification_level,active",
        { column: "course_title" },
      );
      return data.map((row): CourseRecord => ({
        courseKey: textValue(row.course_key),
        courseTitle: textValue(row.course_title),
        code: nullableText(row.code),
        qualificationLevel: nullableText(row.qualification_level),
        active: booleanValue(row.active),
      }));
    },

    async listContracts() {
      const data = await rows(
        "platform_contracts",
        "contract_key,version,status,compatibility,contract_document",
        { column: "contract_key" },
      );
      return data.map((row): PlatformContractRecord => {
        const document = objectValue(row.contract_document);
        return {
          contractKey: textValue(row.contract_key),
          version: textValue(row.version),
          status: textValue(row.status) as PlatformContractRecord["status"],
          boundary:
            nullableText(document.boundary) ?? "Versioned platform contract",
          compatibility: objectValue(row.compatibility),
        };
      });
    },

    async listHealth() {
      const data = await rows(
        "operational_health",
        "service_key,status,checked_at,valid_until,public_message",
        { column: "service_key" },
      );
      return data.map((row): HealthRecord => ({
        serviceKey: textValue(row.service_key),
        label: labelForKey(textValue(row.service_key)),
        status: textValue(row.status) as HealthRecord["status"],
        checkedAt: nullableText(row.checked_at),
        validUntil: nullableText(row.valid_until),
        message:
          nullableText(row.public_message) ?? "No public status message is available.",
        source: "live",
      }));
    },

    async listTeachers() {
      const data = await rows(
        "staff_roles",
        "staff_reference,display_name,role,revoked_at",
        { column: "display_name" },
      );
      return data.map((row): TeacherRecord => ({
        staffReference: textValue(row.staff_reference),
        displayName: textValue(row.display_name),
        active: row.revoked_at === null,
        roleLabel: textValue(row.role).replaceAll("_", " "),
      }));
    },

    async listLearners() {
      const data = await rows(
        "learners",
        "student_number,display_name,active,group_codes,active_enrolment_count",
        { column: "student_number" },
      );
      return data.map((row): LearnerRecord => ({
        studentNumber: textValue(row.student_number),
        displayName: textValue(row.display_name),
        active: booleanValue(row.active),
        groupCodes: stringArray(row.group_codes),
        activeEnrolmentCount: numberValue(row.active_enrolment_count),
      }));
    },

    async listGroups() {
      const data = await rows(
        "groups",
        "group_code,group_name,year_group,registration_open,active,academic_year,course_key,course_title,active_learner_count",
        { column: "group_code" },
      );
      return data.map((row): GroupRecord => ({
        groupCode: textValue(row.group_code),
        groupName: textValue(row.group_name),
        academicYear: textValue(row.academic_year),
        yearGroup: textValue(row.year_group),
        courseKey: textValue(row.course_key),
        courseTitle: textValue(row.course_title),
        registrationOpen: booleanValue(row.registration_open),
        active: booleanValue(row.active),
        activeLearnerCount: numberValue(row.active_learner_count),
      }));
    },

    async listEnrolments() {
      const data = await rows(
        "enrolments",
        "student_number,group_code,joined_on,left_on,status",
        { column: "joined_on", ascending: false },
      );
      return data.map((row): EnrolmentRecord => ({
        learnerNumber: textValue(row.student_number),
        groupCode: textValue(row.group_code),
        joinedOn: textValue(row.joined_on),
        leftOn: nullableText(row.left_on),
        status: textValue(row.status),
      }));
    },

    async listAssignments() {
      const data = await rows(
        "assignments",
        "group_code,activity_key,activity_version,opens_at,due_at,required,active",
        { column: "group_code" },
      );
      return data.map((row): AssignmentRecord => ({
        groupCode: textValue(row.group_code),
        activityKey: textValue(row.activity_key),
        activityVersion: textValue(row.activity_version),
        opensAt: nullableText(row.opens_at),
        dueAt: nullableText(row.due_at),
        required: booleanValue(row.required),
        active: booleanValue(row.active),
      }));
    },

    async listAttempts() {
      const data = await rows(
        "attempts",
        "attempt_id,student_number,group_code,activity_key,activity_version,attempt_number,status,score,max_score,marking_source,evidence_level,received_at,completed_at,requires_review,question_count",
        { column: "completed_at", ascending: false },
      );
      return data.map((row): AttemptRecord => ({
        attemptId: textValue(row.attempt_id),
        learnerNumber: textValue(row.student_number),
        groupCode: textValue(row.group_code),
        activityKey: textValue(row.activity_key),
        activityVersion: textValue(row.activity_version),
        attemptNumber: numberValue(row.attempt_number),
        status: textValue(row.status),
        score: numberValue(row.score),
        maxScore: numberValue(row.max_score),
        markingSource: textValue(row.marking_source),
        evidenceLevel: textValue(row.evidence_level),
        receivedAt: textValue(row.received_at),
        completedAt: textValue(row.completed_at),
        requiresReview: booleanValue(row.requires_review),
        questionCount: nullableNumber(row.question_count),
      }));
    },

    async listRecentAttempts() {
      const data = await rows(
        "recent_attempts",
        "attempt_id,student_number,activity_key,activity_version,status,score,max_score,completed_at",
      );
      return data.map((row): RecentAttemptRecord => ({
        attemptId: textValue(row.attempt_id),
        learnerNumber: textValue(row.student_number),
        activityKey: textValue(row.activity_key),
        activityVersion: textValue(row.activity_version),
        status: textValue(row.status),
        score: numberValue(row.score),
        maxScore: numberValue(row.max_score),
        completedAt: textValue(row.completed_at),
      }));
    },

    async listResponses() {
      const data = await rows(
        "responses",
        "response_id,attempt_id,student_number,group_code,activity_key,question_key,question_type,section_key,section_title,ordinal,topic_keys,skill_keys,response_payload,awarded_score,max_score,is_correct,requires_review,marking_source,marked_at,feedback_summary,feedback_next_step",
        { column: "marked_at", ascending: false },
      );
      return data.map((row): ResponseRecord => ({
        responseId: textValue(row.response_id),
        attemptId: textValue(row.attempt_id),
        learnerNumber: textValue(row.student_number),
        groupCode: textValue(row.group_code),
        activityKey: textValue(row.activity_key),
        questionKey: textValue(row.question_key),
        questionType: textValue(row.question_type),
        sectionKey: nullableText(row.section_key),
        sectionTitle: nullableText(row.section_title),
        ordinal: numberValue(row.ordinal),
        topicKeys: stringArray(row.topic_keys),
        skillKeys: stringArray(row.skill_keys),
        responsePayload: objectValue(row.response_payload),
        score: nullableNumber(row.awarded_score),
        maxScore: numberValue(row.max_score),
        isCorrect: row.is_correct === null ? null : booleanValue(row.is_correct),
        requiresReview: booleanValue(row.requires_review),
        markingSource: textValue(row.marking_source),
        markedAt: textValue(row.marked_at),
        feedbackSummary: nullableText(row.feedback_summary),
        feedbackNextStep: nullableText(row.feedback_next_step),
      }));
    },

    async listActivityPerformance() {
      const data = await rows(
        "activity_performance",
        "group_code,activity_key,activity_version,completed_attempts,learner_count,average_score_percentage,best_score_percentage,first_completed_at,latest_completed_at",
        { column: "latest_completed_at", ascending: false },
      );
      return data.map((row): ActivityPerformanceRecord => ({
        groupCode: textValue(row.group_code),
        activityKey: textValue(row.activity_key),
        activityVersion: textValue(row.activity_version),
        completedAttempts: numberValue(row.completed_attempts),
        learnerCount: numberValue(row.learner_count),
        averageScorePercentage: nullableNumber(row.average_score_percentage),
        bestScorePercentage: nullableNumber(row.best_score_percentage),
        firstCompletedAt: textValue(row.first_completed_at),
        latestCompletedAt: textValue(row.latest_completed_at),
      }));
    },

    async getAssessmentOverview() {
      const data = await rows(
        "assessment_overview",
        "active_learners,active_groups,attempt_count,completed_attempts,completion_percentage,average_score_percentage,requires_review_count,reviewed_response_count,assignment_count,participating_learner_count,topic_link_count,skill_link_count",
      );
      if (!data[0]) return null;
      const row = data[0];
      return Object.freeze({
        activeLearners: numberValue(row.active_learners),
        activeGroups: numberValue(row.active_groups),
        attemptCount: numberValue(row.attempt_count),
        completedAttempts: numberValue(row.completed_attempts),
        completionPercentage: nullableNumber(row.completion_percentage),
        averageScorePercentage: nullableNumber(row.average_score_percentage),
        requiresReviewCount: numberValue(row.requires_review_count),
        reviewedResponseCount: numberValue(row.reviewed_response_count),
        assignmentCount: numberValue(row.assignment_count),
        participatingLearnerCount: numberValue(row.participating_learner_count),
        topicLinkCount: numberValue(row.topic_link_count),
        skillLinkCount: numberValue(row.skill_link_count),
      }) satisfies AssessmentOverviewRecord;
    },

    async listGroupPerformance() {
      const data = await rows(
        "group_performance",
        "group_code,group_name,course_key,course_title,active_learner_count,participating_learner_count,completed_attempts,attempt_count,average_score_percentage,best_score_percentage,latest_score_percentage,requires_review_count,reviewed_response_count,assignment_count",
        { column: "group_code" },
      );
      return data.map((row): GroupPerformanceRecord => ({
        groupCode: textValue(row.group_code),
        groupName: textValue(row.group_name),
        courseKey: textValue(row.course_key),
        courseTitle: nullableText(row.course_title),
        activeLearnerCount: numberValue(row.active_learner_count),
        participatingLearnerCount: numberValue(row.participating_learner_count),
        completedAttempts: numberValue(row.completed_attempts),
        attemptCount: numberValue(row.attempt_count),
        averageScorePercentage: nullableNumber(row.average_score_percentage),
        bestScorePercentage: nullableNumber(row.best_score_percentage),
        latestScorePercentage: nullableNumber(row.latest_score_percentage),
        requiresReviewCount: numberValue(row.requires_review_count),
        reviewedResponseCount: numberValue(row.reviewed_response_count),
        assignmentCount: numberValue(row.assignment_count),
      }));
    },

    async listLearnerPerformance() {
      const data = await rows(
        "learner_performance",
        "learner_id,student_number,display_name,group_codes,assigned_activity_count,completed_activity_count,attempt_count,completed_attempts,average_score_percentage,best_score_percentage,latest_score_percentage,first_score_percentage,requires_review_count,reviewed_response_count,latest_completed_at",
        { column: "student_number" },
      );
      return data.map((row): LearnerPerformanceRecord => ({
        learnerId: textValue(row.learner_id),
        studentNumber: textValue(row.student_number),
        displayName: textValue(row.display_name),
        groupCodes: stringArray(row.group_codes),
        assignedActivityCount: numberValue(row.assigned_activity_count),
        completedActivityCount: numberValue(row.completed_activity_count),
        attemptCount: numberValue(row.attempt_count),
        completedAttempts: numberValue(row.completed_attempts),
        averageScorePercentage: nullableNumber(row.average_score_percentage),
        bestScorePercentage: nullableNumber(row.best_score_percentage),
        latestScorePercentage: nullableNumber(row.latest_score_percentage),
        firstScorePercentage: nullableNumber(row.first_score_percentage),
        requiresReviewCount: numberValue(row.requires_review_count),
        reviewedResponseCount: numberValue(row.reviewed_response_count),
        latestCompletedAt: nullableText(row.latest_completed_at),
      }));
    },

    async listLearnerActivityPerformance() {
      const data = await pagedRows(
        "learner_activity_performance",
        "learner_id,student_number,display_name,course_id,course_key,course_title,group_id,group_code,group_name,assignment_id,activity_id,activity_key,activity_title,activity_version,hub_codes,hub_names,week_number,week_title,attempt_count,completed_attempt_count,first_score_percentage,latest_score_percentage,best_score_percentage,average_score_percentage,first_completed_at,latest_completed_at,requires_review_count,reviewed_response_count",
        [
          { column: "learner_id" },
          { column: "assignment_id" },
          { column: "activity_id" },
        ],
      );
      return data.map((row): LearnerActivityPerformanceRecord => ({
        learnerId: textValue(row.learner_id),
        studentNumber: textValue(row.student_number),
        displayName: textValue(row.display_name),
        courseId: textValue(row.course_id),
        courseKey: textValue(row.course_key),
        courseTitle: textValue(row.course_title),
        groupId: textValue(row.group_id),
        groupCode: textValue(row.group_code),
        groupName: textValue(row.group_name),
        assignmentId: textValue(row.assignment_id),
        activityId: textValue(row.activity_id),
        activityKey: textValue(row.activity_key),
        activityTitle: textValue(row.activity_title),
        activityVersion: textValue(row.activity_version),
        hubCodes: stringArray(row.hub_codes),
        hubNames: stringArray(row.hub_names),
        weekNumber: row.week_number == null ? null : numberValue(row.week_number),
        weekTitle: nullableText(row.week_title),
        attemptCount: numberValue(row.attempt_count),
        completedAttemptCount: numberValue(row.completed_attempt_count),
        firstScorePercentage: nullableNumber(row.first_score_percentage),
        latestScorePercentage: nullableNumber(row.latest_score_percentage),
        bestScorePercentage: nullableNumber(row.best_score_percentage),
        averageScorePercentage: nullableNumber(row.average_score_percentage),
        firstCompletedAt: nullableText(row.first_completed_at),
        latestCompletedAt: nullableText(row.latest_completed_at),
        requiresReviewCount: numberValue(row.requires_review_count),
        reviewedResponseCount: numberValue(row.reviewed_response_count),
      }));
    },

    async listActivityAnalytics() {
      const data = await pagedRows(
        "activity_analytics",
        "group_code,group_name,course_key,course_title,assignment_id,activity_id,activity_key,activity_title,activity_version,assigned_learner_count,attempted_learner_count,completed_learner_count,completion_percentage,participation_percentage,attempt_count,completed_attempts,average_score_percentage,best_score_percentage,latest_score_percentage,requires_review_count,reviewed_response_count,latest_completed_at",
        [
          { column: "assignment_id" },
          { column: "group_code" },
          { column: "activity_key" },
          { column: "activity_version" },
        ],
      );
      return data.map((row): ActivityAnalyticsRecord => ({
        groupCode: textValue(row.group_code),
        groupName: nullableText(row.group_name),
        courseKey: textValue(row.course_key),
        courseTitle: nullableText(row.course_title),
        assignmentId: nullableText(row.assignment_id),
        activityId: nullableText(row.activity_id),
        activityKey: textValue(row.activity_key),
        activityTitle: nullableText(row.activity_title),
        activityVersion: textValue(row.activity_version),
        assignedLearnerCount: numberValue(row.assigned_learner_count),
        attemptedLearnerCount: numberValue(row.attempted_learner_count),
        completedLearnerCount: numberValue(row.completed_learner_count),
        completionPercentage: nullableNumber(row.completion_percentage),
        participationPercentage: nullableNumber(row.participation_percentage),
        attemptCount: numberValue(row.attempt_count),
        completedAttempts: numberValue(row.completed_attempts),
        averageScorePercentage: nullableNumber(row.average_score_percentage),
        bestScorePercentage: nullableNumber(row.best_score_percentage),
        latestScorePercentage: nullableNumber(row.latest_score_percentage),
        requiresReviewCount: numberValue(row.requires_review_count),
        reviewedResponseCount: numberValue(row.reviewed_response_count),
        latestCompletedAt: nullableText(row.latest_completed_at),
      }));
    },

    async listQuestionPerformance() {
      const data = await pagedRows(
        "question_performance",
        "activity_key,activity_version,question_key,question_type,section_key,topic_keys,skill_keys,response_count,correct_count,incorrect_count,requires_review_count,reviewed_response_count,correctness_percentage,average_awarded_score,average_max_score",
        [
          { column: "activity_key" },
          { column: "activity_version" },
          { column: "question_key" },
        ],
      );
      return data.map((row): QuestionPerformanceRecord => ({
        activityKey: textValue(row.activity_key),
        activityVersion: textValue(row.activity_version),
        questionKey: textValue(row.question_key),
        questionType: textValue(row.question_type),
        sectionKey: nullableText(row.section_key),
        topicKeys: stringArray(row.topic_keys),
        skillKeys: stringArray(row.skill_keys),
        responseCount: numberValue(row.response_count),
        correctCount: numberValue(row.correct_count),
        incorrectCount: numberValue(row.incorrect_count),
        requiresReviewCount: numberValue(row.requires_review_count),
        reviewedResponseCount: numberValue(row.reviewed_response_count),
        correctnessPercentage: nullableNumber(row.correctness_percentage),
        averageAwardedScore: nullableNumber(row.average_awarded_score),
        averageMaxScore: nullableNumber(row.average_max_score),
      }));
    },

    async listQuestionGroupPerformance() {
      const data = await pagedRows(
        "question_group_performance",
        "group_code,group_name,course_key,course_title,assignment_id,activity_key,activity_title,activity_version,question_key,question_title,question_type,section_key,ordinal,topic_keys,skill_keys,response_count,correct_count,incorrect_count,unanswered_count,requires_review_count,reviewed_response_count,correctness_percentage,average_awarded_score,average_max_score",
        [
          { column: "assignment_id" },
          { column: "activity_version" },
          { column: "question_key" },
        ],
      );
      return data.map((row): QuestionGroupPerformanceRecord => ({
        groupCode: textValue(row.group_code),
        groupName: textValue(row.group_name),
        courseKey: textValue(row.course_key),
        courseTitle: textValue(row.course_title),
        assignmentId: textValue(row.assignment_id),
        activityKey: textValue(row.activity_key),
        activityTitle: textValue(row.activity_title),
        activityVersion: textValue(row.activity_version),
        questionKey: textValue(row.question_key),
        questionTitle: textValue(row.question_title),
        questionType: textValue(row.question_type),
        sectionKey: nullableText(row.section_key),
        ordinal: numberValue(row.ordinal),
        topicKeys: stringArray(row.topic_keys),
        skillKeys: stringArray(row.skill_keys),
        responseCount: numberValue(row.response_count),
        correctCount: numberValue(row.correct_count),
        incorrectCount: numberValue(row.incorrect_count),
        unansweredCount: numberValue(row.unanswered_count),
        requiresReviewCount: numberValue(row.requires_review_count),
        reviewedResponseCount: numberValue(row.reviewed_response_count),
        correctnessPercentage: nullableNumber(row.correctness_percentage),
        averageAwardedScore: nullableNumber(row.average_awarded_score),
        averageMaxScore: nullableNumber(row.average_max_score),
      }));
    },

    async listTopicPerformance() {
      const data = await rows(
        "topic_performance",
        "topic_key,response_count,attempt_count,learner_count,correct_count,incorrect_count,requires_review_count,success_percentage,average_awarded_score",
        { column: "topic_key" },
      );
      return data.map((row): TopicPerformanceRecord => ({
        topicKey: textValue(row.topic_key),
        responseCount: numberValue(row.response_count),
        attemptCount: numberValue(row.attempt_count),
        learnerCount: numberValue(row.learner_count),
        correctCount: numberValue(row.correct_count),
        incorrectCount: numberValue(row.incorrect_count),
        requiresReviewCount: numberValue(row.requires_review_count),
        successPercentage: nullableNumber(row.success_percentage),
        averageAwardedScore: nullableNumber(row.average_awarded_score),
      }));
    },

    async listSkillPerformance() {
      const data = await rows(
        "skill_performance",
        "skill_key,response_count,attempt_count,learner_count,correct_count,incorrect_count,requires_review_count,success_percentage,average_awarded_score",
        { column: "skill_key" },
      );
      return data.map((row): SkillPerformanceRecord => ({
        skillKey: textValue(row.skill_key),
        responseCount: numberValue(row.response_count),
        attemptCount: numberValue(row.attempt_count),
        learnerCount: numberValue(row.learner_count),
        correctCount: numberValue(row.correct_count),
        incorrectCount: numberValue(row.incorrect_count),
        requiresReviewCount: numberValue(row.requires_review_count),
        successPercentage: nullableNumber(row.success_percentage),
        averageAwardedScore: nullableNumber(row.average_awarded_score),
      }));
    },

    async listDiagnosticSessions() {
      const data = await pagedRows(
        "diagnostic_sessions",
        "session_id,student_name,student_id,hub_code,hub_name,course_key,course_title,diagnostic_key,diagnostic_version,status,started_at,completed_at,response_count,not_sure_count,awarded_score,max_score,score_percentage",
        { column: "started_at", ascending: false },
      );
      return data.map((row): DiagnosticSessionRecord => ({
        sessionId: textValue(row.session_id),
        studentName: textValue(row.student_name),
        studentId: textValue(row.student_id),
        hubCode: textValue(row.hub_code),
        hubName: textValue(row.hub_name),
        courseKey: textValue(row.course_key),
        courseTitle: textValue(row.course_title),
        diagnosticKey: nullableText(row.diagnostic_key),
        diagnosticVersion: nullableText(row.diagnostic_version),
        status: textValue(row.status) as DiagnosticSessionRecord["status"],
        startedAt: textValue(row.started_at),
        completedAt: nullableText(row.completed_at),
        responseCount: numberValue(row.response_count),
        notSureCount: numberValue(row.not_sure_count),
        awardedScore: nullableNumber(row.awarded_score),
        maxScore: nullableNumber(row.max_score),
        scorePercentage: nullableNumber(row.score_percentage),
      }));
    },

    async listDiagnosticResponses() {
      const data = await pagedRows(
        "diagnostic_responses",
        "response_id,session_id,student_name,student_id,hub_code,course_key,activity_id,unit_key,topic_key,question_key,evidence,is_not_sure,confidence,is_correct,awarded_score,max_score,created_at,updated_at",
        { column: "created_at" },
      );
      return data.map((row): DiagnosticResponseRecord => ({
        responseId: textValue(row.response_id),
        sessionId: textValue(row.session_id),
        studentName: textValue(row.student_name),
        studentId: textValue(row.student_id),
        hubCode: textValue(row.hub_code),
        courseKey: textValue(row.course_key),
        activityId: textValue(row.activity_id),
        unitKey: textValue(row.unit_key),
        topicKey: nullableText(row.topic_key),
        questionKey: textValue(row.question_key),
        evidence: jsonUnknown(row.evidence),
        isNotSure: booleanValue(row.is_not_sure),
        confidence: nullableText(row.confidence),
        isCorrect: nullableBoolean(row.is_correct),
        awardedScore: nullableNumber(row.awarded_score),
        maxScore: nullableNumber(row.max_score),
        createdAt: textValue(row.created_at),
        updatedAt: textValue(row.updated_at),
      }));
    },

    async listDiagnosticSummary() {
      const data = await rows(
        "diagnostic_summary",
        "hub_code,course_key,started_count,completed_count,completion_percentage,response_count,not_sure_count,not_sure_percentage",
        { column: "hub_code" },
      );
      return data.map((row): DiagnosticSummaryRecord => ({
        hubCode: textValue(row.hub_code),
        courseKey: textValue(row.course_key),
        startedCount: numberValue(row.started_count),
        completedCount: numberValue(row.completed_count),
        completionPercentage: nullableNumber(row.completion_percentage),
        responseCount: numberValue(row.response_count),
        notSureCount: numberValue(row.not_sure_count),
        notSurePercentage: nullableNumber(row.not_sure_percentage),
      }));
    },

    async getDashboardSummary() {
      const data = await rows(
        "dashboard_summary",
        "registered_hubs,active_hubs,active_learners,active_groups,active_enrolments,assignments,recent_attempts,completed_attempts,average_score_percentage,healthy_services,service_count,active_contracts,contract_count",
      );
      if (!data[0]) throw new AdminReadError("access-denied", "dashboard_summary");
      return mapDashboard(data[0]);
    },

    async listAuditEvents() {
      const data = await rows(
        "audit_events",
        "event_key,actor_type,entity_type,entity_key,outcome,occurred_at",
        { column: "occurred_at", ascending: false },
      );
      return data.map((row): AuditEventRecord => ({
        eventKey: textValue(row.event_key),
        actorType: textValue(row.actor_type),
        entityType: textValue(row.entity_type),
        entityKey: nullableText(row.entity_key),
        outcome: textValue(row.outcome),
        occurredAt: textValue(row.occurred_at),
      }));
    },

    async listCurriculumPublications() {
      const data = await rows(
        "curriculum_publications",
        "id,hub_code,course_key,package_version,schema_version,source_package_version,status,author,reviewer,publication_notes,published_by_staff_reference,created_at,published_at,content_hash",
        { column: "published_at", ascending: false },
      );
      return data.map((row): CurriculumPublicationRecord => ({
        id: textValue(row.id),
        hubCode: textValue(row.hub_code),
        courseKey: textValue(row.course_key),
        packageVersion: textValue(row.package_version),
        schemaVersion: textValue(row.schema_version),
        sourcePackageVersion: textValue(row.source_package_version),
        status: textValue(row.status) as CurriculumPublicationRecord["status"],
        author: textValue(row.author),
        reviewer: textValue(row.reviewer),
        publicationNotes: textValue(row.publication_notes),
        publishedBy: textValue(row.published_by_staff_reference),
        createdAt: textValue(row.created_at),
        publishedAt: textValue(row.published_at),
        contentHash: textValue(row.content_hash),
      }));
    },

    async listCurriculumDrafts() {
      const data = await rows(
        "curriculum_drafts",
        "id,hub_code,course_key,title,lifecycle_status,revision,based_on_package_version,updated_at",
        { column: "updated_at", ascending: false },
      );
      return data.map((row): CurriculumDraftSummary => ({
        id: textValue(row.id),
        hubCode: textValue(row.hub_code),
        courseKey: textValue(row.course_key),
        title: textValue(row.title),
        lifecycleStatus: textValue(row.lifecycle_status),
        revision: Number(row.revision || 0),
        basedOnPackageVersion: row.based_on_package_version ? textValue(row.based_on_package_version) : null,
        updatedAt: textValue(row.updated_at),
      }));
    },
  });
}

export async function loadAdminData(
  service: AdminReadService,
): Promise<AdminDataSnapshot> {
  const [
    hubs,
    hubCourseLinks,
    courses,
    contracts,
    health,
    teachers,
    learners,
    groups,
    enrolments,
    assignments,
    attempts,
    responses,
    activityPerformance,
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
    dashboardSummary,
    auditEvents,
    curriculumPublications,
    curriculumDrafts,
  ] = await Promise.all([
    service.listHubs(),
    service.listHubCourseLinks(),
    service.listCourses(),
    service.listContracts(),
    service.listHealth(),
    service.listTeachers(),
    service.listLearners(),
    service.listGroups(),
    service.listEnrolments(),
    service.listAssignments(),
    service.listAttempts(),
    service.listResponses(),
    service.listActivityPerformance(),
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
    service.getDashboardSummary(),
    service.listAuditEvents(),
    service.listCurriculumPublications(),
    service.listCurriculumDrafts(),
  ]);

  return Object.freeze({
    hubs,
    hubCourseLinks,
    courses,
    contracts,
    health,
    teachers,
    learners,
    groups,
    enrolments,
    assignments,
    attempts,
    responses,
    activityPerformance,
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
    dashboardSummary,
    auditEvents,
    curriculumPublications,
    curriculumDrafts,
  });
}
