import { canTransition, isEditableStatus, isImmutableStatus } from "./lifecycle.ts";
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
    return "This snapshot is already on the platform. For week visibility, use Post week & publish / Remove week & publish (creates a new draft and version). For other edits, create a new draft from published, then use Review and Publication.";
  }
  if (record.status !== "published") {
    return "Publish an immutable version first (Approve → Publish immutable version), then Publish to Platform.";
  }
  return "Publish to Platform is not available for this record yet.";
}

export type WeekVisibilityRecovery = "working-copy" | "return-to-draft" | null;

/** How staff can regain an editable Draft for content edits (optional for visibility publish). */
export function weekVisibilityRecoveryAction(record: AuthoringDraft): WeekVisibilityRecovery {
  if (isEditableStatus(record.status)) return null;
  if (isImmutableStatus(record.status)) return "working-copy";
  if (canTransition(record.status, "draft")) return "return-to-draft";
  return null;
}

/** Guidance on the Weeks tab for the current record. */
export function weekVisibilityNextSteps(record: AuthoringDraft): string {
  const recovery = weekVisibilityRecoveryAction(record);
  if (recovery === "working-copy") {
    return "This snapshot is read-only. Use Post week & publish / Remove week & publish to open a working copy and push visibility to learners in one step. For other curriculum edits, create a new draft from published first.";
  }
  if (recovery === "return-to-draft") {
    return "This record is in review. Post week & publish / Remove week & publish will return it to Draft, then publish. Or use Return to Draft for content edits.";
  }
  return WEEK_VISIBILITY_PUBLISH_REMINDER;
}

export function afterPlatformPublishGuidance(): string {
  return "Published to the platform. Learner hubs load this version from Supabase without a GitHub deployment. To change week visibility again, use Post week & publish or Remove week & publish on Weeks.";
}
