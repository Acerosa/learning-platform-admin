import { StatusBadge, type BadgeTone } from "../status-badge";
import { isEditableStatus, LIFECYCLE_LABELS } from "../../content/lifecycle";
import { weekVisibilityRecoveryAction } from "../../content/publication-guidance";
import type { AuthoringDraft, LifecycleStatus } from "../../content/types";

export function lifecycleTone(status: LifecycleStatus): BadgeTone {
  if (status === "published" || status === "approved") return "positive";
  if (status === "draft") return "warning";
  if (status === "archived" || status === "superseded") return "neutral";
  return "info";
}

export function LifecycleBanner({
  record,
  onCreateWorkingCopy,
  onReturnToDraft,
}: {
  record: AuthoringDraft;
  onCreateWorkingCopy?: () => void;
  onReturnToDraft?: () => void;
}) {
  const editable = isEditableStatus(record.status);
  const recovery = weekVisibilityRecoveryAction(record);
  const platformDone = record.status === "published" && record.platformPublicationState === "published";
  return (
    <div className="authoring-banner" role="status">
      <StatusBadge label={LIFECYCLE_LABELS[record.status]} tone={lifecycleTone(record.status)} />
      {record.version ? <span>Version {record.version}</span> : <span>Working copy</span>}
      {record.basedOnVersion ? <span>Based on {record.basedOnVersion}</span> : null}
      <p>
        {editable
          ? "Admin edits this Draft. Learners never see drafts."
          : platformDone
            ? "This snapshot is on the platform and read-only. Create a new draft from published to Post/Remove weeks again."
            : recovery === "return-to-draft"
              ? "This record is in review and read-only. Return to Draft to Post/Remove weeks."
              : "This record is read-only. Restore as Draft or open a working copy to edit."}
      </p>
      {recovery === "working-copy" && onCreateWorkingCopy ? (
        <button className="button button--small button--secondary" type="button" onClick={onCreateWorkingCopy}>
          Create new draft from published
        </button>
      ) : null}
      {recovery === "return-to-draft" && onReturnToDraft ? (
        <button className="button button--small button--secondary" type="button" onClick={onReturnToDraft}>
          Return to Draft
        </button>
      ) : null}
    </div>
  );
}
