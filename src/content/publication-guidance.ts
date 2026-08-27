import { isEditableStatus } from "./lifecycle.ts";
import type { AuthoringDraft } from "./types.ts";
import { WEEK_VISIBILITY_PUBLISH_REMINDER } from "./week-availability.ts";

export function canPublishToPlatform(record: AuthoringDraft, platformAvailable: boolean): boolean {
  return record.status === "published"
    && record.platformPublicationState !== "publishing"
    && record.platformPublicationState !== "published"
    && platformAvailable;
}

/** Why Publish to Platform is disabled, or null when it is enabled. */
export function platformPublishBlockedReason(
  record: AuthoringDraft,
  platformAvailable: boolean,
): string | null {
  if (canPublishToPlatform(record, platformAvailable)) return null;
  if (!platformAvailable) {
    return "Publish to Platform requires a live administrator session.";
  }
  if (record.platformPublicationState === "publishing") {
    return "Platform publication is already in progress.";
  }
  if (record.status === "published" && record.platformPublicationState === "published") {
    return "This snapshot is already on the platform. Create a new draft from published, Post/Remove weeks, Approve, Publish an immutable version, then Publish to Platform again.";
  }
  if (record.status !== "published") {
    return "Publish an immutable version first (Approve → Publish immutable version), then Publish to Platform.";
  }
  return "Publish to Platform is not available for this record yet.";
}

/** Guidance after Post/Remove week on the current record. */
export function weekVisibilityNextSteps(record: AuthoringDraft): string {
  if (!isEditableStatus(record.status)) {
    return "This record is read-only. Create a new draft from published, then Post/Remove, Approve, Publish immutable, and Publish to Platform.";
  }
  return `${WEEK_VISIBILITY_PUBLISH_REMINDER} Next: Save draft → Review (Ready for Review → In Review → Approve) → Publication (Publish immutable version → Publish to Platform).`;
}

export function afterPlatformPublishGuidance(): string {
  return "Published to the platform. Learner hubs load this version from Supabase without a GitHub deployment. To Post or Remove another week later: Versions → Open working copy, then Approve → Publish immutable → Publish to Platform.";
}
