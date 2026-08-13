import { canTransition, LIFECYCLE_LABELS } from "../../content/lifecycle";
import type { AuthoringDraft } from "../../content/types";
import { StatusBadge } from "../status-badge";
import { lifecycleTone } from "./lifecycle-banner";

export function ArchivePanel({
  records,
  current,
  onArchive,
}: {
  records: readonly AuthoringDraft[];
  current: AuthoringDraft;
  onArchive: (record: AuthoringDraft) => void;
}) {
  const candidates = records.filter((item) => (
    item.hubId === current.hubId
    && item.courseKey === current.courseKey
    && canTransition(item.status, "archived")
  ));
  return (
    <section className="panel">
      <h2>Archive</h2>
      <p>Archiving is a lifecycle transition. Archived versions remain immutable history and are not learner content.</p>
      {candidates.length ? (
        <ul className="authoring-list">
          {candidates.map((item) => (
            <li key={item.id}>
              <strong>{item.version || "working copy"}</strong>
              <StatusBadge label={LIFECYCLE_LABELS[item.status]} tone={lifecycleTone(item.status)} />
              <button className="button button--small button--secondary" type="button" onClick={() => onArchive(item)}>
                Archive
              </button>
            </li>
          ))}
        </ul>
      ) : <p>No published or superseded versions are available to archive.</p>}
    </section>
  );
}
