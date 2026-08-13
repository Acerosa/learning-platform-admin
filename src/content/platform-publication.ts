import { LifecycleError } from "./lifecycle.ts";
import type { AuthoringDraft } from "./types.ts";

export const PLATFORM_PUBLISHABLE_STATUSES = ["approved", "published"] as const;

export function isPlatformPublishable(status: AuthoringDraft["status"]) {
  return (PLATFORM_PUBLISHABLE_STATUSES as readonly string[]).includes(status);
}

export function assertPlatformPublishable(record: AuthoringDraft) {
  if (!isPlatformPublishable(record.status)) {
    throw new LifecycleError("Only Approved or Published snapshots can enter the backend pipeline.");
  }
  if (!record.version.trim()) {
    throw new LifecycleError("Platform publication requires an assigned version.");
  }
}

export function platformPublicationArgs(record: AuthoringDraft) {
  assertPlatformPublishable(record);
  return {
    p_lifecycle_status: record.status,
    p_hub_code: record.hubId,
    p_course_key: record.courseKey,
    p_package_version: record.version,
    p_schema_version: record.schemaVersion,
    p_source_package_version: record.sourcePackageVersion,
    p_package: record.package,
    p_author: record.author,
    p_reviewer: record.reviewer,
    p_publication_notes: record.publicationNotes,
  };
}
