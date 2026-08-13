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

export function hubRegistrationContext(data: AdminDataSnapshot): HubManifestValidationContext {
  return {
    activeContracts: data.contracts,
    knownCourseKeys: [...new Set(data.hubCourseLinks.map((link) => link.courseKey))],
    existingHubCodes: data.hubs.map((hub) => hub.hubCode),
    existingRepositoryUrls: data.hubs.map((hub) => hub.repositoryUrl),
    existingDeploymentUrls: data.hubs.flatMap((hub) => hub.deploymentUrl ? [hub.deploymentUrl] : []),
  };
}

export function validateHubRegistration(
  manifest: unknown,
  status: HubLifecycle,
  active: boolean,
  data: AdminDataSnapshot,
) {
  const report = validateHubManifest(manifest, hubRegistrationContext(data));
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

  const hub = hubRecordFromManifest(report.manifest, request.status, request.active);
  const courseTitle = (courseKey: string) => (
    snapshot.hubCourseLinks.find((link) => link.courseKey === courseKey)?.courseTitle ?? courseKey
  );
  const linkedAt = new Date().toISOString();
  const courseLinks: HubCourseLinkRecord[] = report.manifest.courses.map((courseKey) => ({
    hubCode: hub.hubCode,
    courseKey,
    courseTitle: courseTitle(courseKey),
    active: true,
    linkedAt,
  }));
  const auditEvent: AuditEventRecord = {
    eventKey: "hub.registration.registered",
    actorType: "staff",
    entityType: "hub",
    entityKey: hub.hubCode,
    outcome: "succeeded",
    occurredAt: linkedAt,
  };

  return {
    result: { hub, courseKeys: report.manifest.courses },
    snapshot: Object.freeze({
      ...snapshot,
      hubs: Object.freeze([...snapshot.hubs, hub]),
      hubCourseLinks: Object.freeze([...snapshot.hubCourseLinks, ...courseLinks]),
      dashboardSummary: Object.freeze({
        ...snapshot.dashboardSummary,
        registeredHubs: snapshot.dashboardSummary.registeredHubs + 1,
        activeHubs: snapshot.dashboardSummary.activeHubs + (hub.active ? 1 : 0),
      }),
      auditEvents: Object.freeze([auditEvent, ...snapshot.auditEvents]),
    }),
  };
}
