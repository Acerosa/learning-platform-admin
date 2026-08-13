import { LIFECYCLE_LABELS } from "../../content/lifecycle";
import type { AuthoringDraft } from "../../content/types";
import { currentPublished } from "../../content/versioning";
import { StatusBadge } from "../status-badge";
import { lifecycleTone } from "./lifecycle-banner";

export function VersionsPanel({
  records,
  current,
  onSelect,
  onWorkingCopy,
}: {
  records: readonly AuthoringDraft[];
  current: AuthoringDraft;
  onSelect: (record: AuthoringDraft) => void;
  onWorkingCopy: (published: AuthoringDraft) => void;
}) {
  const published = currentPublished(records, current.hubId, current.courseKey);
  const versions = records.filter((item) => item.hubId === current.hubId && item.courseKey === current.courseKey && item.version);
  return (
    <section className="panel">
      <h2>Versions</h2>
      <p>Learners consume Published content only. Opening a published version for editing creates a working copy and leaves the published snapshot untouched.</p>
      <dl className="authoring-meta">
        <div>
          <dt>Current record</dt>
          <dd>{LIFECYCLE_LABELS[current.status]}{current.version ? ` · ${current.version}` : " · working copy"}</dd>
        </div>
        <div>
          <dt>Published for learners (Admin-local)</dt>
          <dd>{published ? `${published.version} · ${LIFECYCLE_LABELS[published.status]}` : "None. Nothing is sent to learner hubs."}</dd>
        </div>
      </dl>
      {published ? (
        <div className="toolbar">
          <button className="button button--primary" type="button" onClick={() => onWorkingCopy(published)}>
            Open working copy
          </button>
        </div>
      ) : null}
      {versions.length ? (
        <ul className="authoring-list">
          {versions.map((item) => (
            <li key={item.id}>
              <strong>{item.version}</strong>
              <StatusBadge label={LIFECYCLE_LABELS[item.status]} tone={lifecycleTone(item.status)} />
              <button className="button button--small button--secondary" type="button" onClick={() => onSelect(item)}>View</button>
            </li>
          ))}
        </ul>
      ) : <p>No published versions yet.</p>}
    </section>
  );
}
