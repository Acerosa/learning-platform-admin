import { createClient } from "@supabase/supabase-js";
import type {
  ActivityPerformanceRecord,
  AdminDataSnapshot,
  AdminReadService,
  AssignmentRecord,
  AttemptRecord,
  AuditEventRecord,
  CurrentStaffContextRecord,
  CurriculumPublicationRecord,
  DashboardSummaryRecord,
  EnrolmentRecord,
  GroupRecord,
  HealthRecord,
  HubCourseLinkRecord,
  HubLifecycle,
  HubRecord,
  LearnerRecord,
  PlatformContractRecord,
  PlatformPublicationResult,
  TeacherRecord,
} from "../api/admin-api";
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

export function createSupabaseAdminReadService(
  client: AdminSupabaseClient,
): AdminReadService {
  async function rows(
    view: string,
    columns: string,
    order?: { column: string; ascending?: boolean },
  ): Promise<readonly AdminRow[]> {
    let query = client.schema("admin_api").from(view).select(columns);
    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }
    const { data, error } = await query;
    if (error) throw new AdminReadError(errorCode(error), view);
    if (!Array.isArray(data)) throw new AdminReadError("invalid-response", view);
    return data as unknown as readonly AdminRow[];
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
        "attempt_id,student_number,group_code,activity_key,activity_version,attempt_number,status,score,max_score,marking_source,evidence_level,received_at,completed_at",
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
  });
}

export async function loadAdminData(
  service: AdminReadService,
): Promise<AdminDataSnapshot> {
  const [
    hubs,
    hubCourseLinks,
    contracts,
    health,
    teachers,
    learners,
    groups,
    enrolments,
    assignments,
    attempts,
    activityPerformance,
    dashboardSummary,
    auditEvents,
    curriculumPublications,
  ] = await Promise.all([
    service.listHubs(),
    service.listHubCourseLinks(),
    service.listContracts(),
    service.listHealth(),
    service.listTeachers(),
    service.listLearners(),
    service.listGroups(),
    service.listEnrolments(),
    service.listAssignments(),
    service.listAttempts(),
    service.listActivityPerformance(),
    service.getDashboardSummary(),
    service.listAuditEvents(),
    service.listCurriculumPublications(),
  ]);

  return Object.freeze({
    hubs,
    hubCourseLinks,
    contracts,
    health,
    teachers,
    learners,
    groups,
    enrolments,
    assignments,
    attempts,
    activityPerformance,
    dashboardSummary,
    auditEvents,
    curriculumPublications,
  });
}
