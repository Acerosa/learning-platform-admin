import type {
  AdminDataSnapshot,
  AuditEventRecord,
  HubCourseLinkRecord,
  HubLifecycle,
  HubRecord,
} from "../api/admin-api";
import {
  activeLifecycleAllowed,
  hubRecordFromManifest,
  type HubManifest,
  type HubManifestValidationContext,
  validateHubManifest,
} from "./hub-manifest.ts";

export interface HubRegistrationRequest {
  manifest: HubManifest;
  status: HubLifecycle;
  active: boolean;
}

export interface HubRegistrationResult {
  hub: HubRecord;
  courseKeys: readonly string[];
}

export function hubRegistrationContext(
  data: AdminDataSnapshot,
  currentHubCode?: string,
): HubManifestValidationContext {
  const knownCourseKeys = data.courses.filter((course) => course.active).map((course) => course.courseKey);
  const otherHubs = data.hubs.filter((hub) => hub.hubCode !== currentHubCode);
  return {
    activeContracts: data.contracts,
    knownCourseKeys: knownCourseKeys.length
      ? knownCourseKeys
      : [...new Set(data.hubCourseLinks.map((link) => link.courseKey))],
    existingHubCodes: otherHubs.map((hub) => hub.hubCode),
    existingRepositoryUrls: otherHubs.map((hub) => hub.repositoryUrl),
    existingDeploymentUrls: otherHubs.flatMap((hub) => hub.deploymentUrl ? [hub.deploymentUrl] : []),
    currentHubCode,
  };
}

export function validateHubRegistration(
  manifest: unknown,
  status: HubLifecycle,
  active: boolean,
  data: AdminDataSnapshot,
  currentHubCode?: string,
) {
  const report = validateHubManifest(manifest, hubRegistrationContext(data, currentHubCode));
  const issues = [...report.issues];
  if (!activeLifecycleAllowed(status, active)) {
    issues.push({
      code: "HUB_ACTIVE_STATUS_INVALID",
      path: "$.status",
      message: "active hubs must use testing, production or maintenance",
    });
  }
  return {
    valid: issues.length === 0,
    issues,
    manifest: issues.length ? null : report.manifest,
  };
}

function courseTitle(snapshot: AdminDataSnapshot, courseKey: string) {
  return snapshot.courses.find((course) => course.courseKey === courseKey)?.courseTitle
    ?? snapshot.hubCourseLinks.find((link) => link.courseKey === courseKey)?.courseTitle
    ?? courseKey;
}

function applyHubSnapshot(
  snapshot: AdminDataSnapshot,
  hub: HubRecord,
  courseKeys: readonly string[],
  eventKey: "hub.registration.registered" | "hub.registration.updated",
  previous?: HubRecord,
): { snapshot: AdminDataSnapshot; result: HubRegistrationResult } {
  const linkedAt = new Date().toISOString();
  const courseLinks: HubCourseLinkRecord[] = courseKeys.map((courseKey) => ({
    hubCode: hub.hubCode,
    courseKey,
    courseTitle: courseTitle(snapshot, courseKey),
    active: true,
    linkedAt,
  }));
  const auditEvent: AuditEventRecord = {
    eventKey,
    actorType: "staff",
    entityType: "hub",
    entityKey: hub.hubCode,
    outcome: "succeeded",
    occurredAt: linkedAt,
  };
  const remainingHubs = snapshot.hubs.filter((item) => item.hubCode !== hub.hubCode);
  const remainingLinks = snapshot.hubCourseLinks.filter((link) => link.hubCode !== hub.hubCode);
  const registeredDelta = previous ? 0 : 1;
  const previousActive = previous?.active ? 1 : 0;
  const nextActive = hub.active ? 1 : 0;

  return {
    result: { hub, courseKeys },
    snapshot: Object.freeze({
      ...snapshot,
      hubs: Object.freeze([...remainingHubs, hub]),
      hubCourseLinks: Object.freeze([...remainingLinks, ...courseLinks]),
      dashboardSummary: Object.freeze({
        ...snapshot.dashboardSummary,
        registeredHubs: snapshot.dashboardSummary.registeredHubs + registeredDelta,
        activeHubs: snapshot.dashboardSummary.activeHubs - previousActive + nextActive,
      }),
      auditEvents: Object.freeze([auditEvent, ...snapshot.auditEvents]),
    }),
  };
}

export function registerDemoHub(
  snapshot: AdminDataSnapshot,
  request: HubRegistrationRequest,
): { snapshot: AdminDataSnapshot; result: HubRegistrationResult } {
  const report = validateHubRegistration(
    request.manifest,
    request.status,
    request.active,
    snapshot,
  );
  if (!report.valid || !report.manifest) {
    const first = report.issues[0];
    throw new Error(first?.code ?? "HUB_MANIFEST_INVALID");
  }

  return applyHubSnapshot(
    snapshot,
    hubRecordFromManifest(report.manifest, request.status, request.active),
    report.manifest.courses,
    "hub.registration.registered",
  );
}

export function updateDemoHub(
  snapshot: AdminDataSnapshot,
  request: HubRegistrationRequest,
): { snapshot: AdminDataSnapshot; result: HubRegistrationResult } {
  const previous = snapshot.hubs.find((hub) => hub.hubCode === request.manifest.hubId);
  if (!previous) {
    throw new Error("HUB_NOT_FOUND");
  }
  const report = validateHubRegistration(
    request.manifest,
    request.status,
    request.active,
    snapshot,
    previous.hubCode,
  );
  if (!report.valid || !report.manifest) {
    const first = report.issues[0];
    throw new Error(first?.code ?? "HUB_MANIFEST_INVALID");
  }

  return applyHubSnapshot(
    snapshot,
    {
      ...previous,
      ...hubRecordFromManifest(report.manifest, request.status, request.active),
      subject: previous.subject,
      curriculumModel: previous.curriculumModel,
      certificationState: previous.certificationState,
    },
    report.manifest.courses,
    "hub.registration.updated",
    previous,
  );
}
