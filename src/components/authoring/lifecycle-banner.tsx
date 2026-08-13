import { StatusBadge, type BadgeTone } from "../status-badge";
import { isEditableStatus, LIFECYCLE_LABELS } from "../../content/lifecycle";
import type { AuthoringDraft, LifecycleStatus } from "../../content/types";

export function lifecycleTone(status: LifecycleStatus): BadgeTone {
  if (status === "published" || status === "approved") return "positive";
  if (status === "draft") return "warning";
  if (status === "archived" || status === "superseded") return "neutral";
  return "info";
}

export function LifecycleBanner({ record }: { record: AuthoringDraft }) {
  const editable = isEditableStatus(record.status);
  return (
    <div className="authoring-banner" role="status">
      <StatusBadge label={LIFECYCLE_LABELS[record.status]} tone={lifecycleTone(record.status)} />
      {record.version ? <span>Version {record.version}</span> : <span>Working copy</span>}
      {record.basedOnVersion ? <span>Based on {record.basedOnVersion}</span> : null}
      <p>
        {editable
          ? "Admin edits this Draft. Learners never see drafts."
          : "This record is read-only. Restore as Draft or open a working copy to edit."}
      </p>
    </div>
  );
}
