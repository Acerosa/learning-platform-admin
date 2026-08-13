import { comparePackages, hasStructuredChanges, type EntityDiff, type FieldChange } from "../../content/compare";
import { LIFECYCLE_LABELS } from "../../content/lifecycle";
import type { AuthoringDraft } from "../../content/types";

function ChangeTable({ caption, changes }: { caption: string; changes: readonly FieldChange[] }) {
  if (!changes.length) {
    return <p role="status">{caption}: no differences.</p>;
  }
  return (
    <div className="table-wrap" aria-label={caption}>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Change</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={`${change.path}-${change.kind}`}>
              <th scope="row">{change.path}</th>
              <td>{change.kind}</td>
              <td>{change.before || "—"}</td>
              <td>{change.after || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntitySection({ title, items }: { title: string; items: readonly EntityDiff[] }) {
  const changed = items.filter((item) => item.kind !== "unchanged");
  if (!changed.length) {
    return <p role="status">{title}: no differences.</p>;
  }
  return (
    <>
      {changed.map((item) => (
        <ChangeTable
          key={item.id}
          caption={`${title}: ${item.label} (${item.kind})`}
          changes={item.changes}
        />
      ))}
    </>
  );
}

function versionLabel(record: AuthoringDraft) {
  return `${record.version || "working copy"} · ${LIFECYCLE_LABELS[record.status]}`;
}

export function ComparePanel({
  records,
  leftId,
  rightId,
  onLeftChange,
  onRightChange,
}: {
  records: readonly AuthoringDraft[];
  leftId: string;
  rightId: string;
  onLeftChange: (id: string) => void;
  onRightChange: (id: string) => void;
}) {
  const left = records.find((item) => item.id === leftId) || records[0];
  const right = records.find((item) => item.id === rightId) || records[1] || records[0];
  const diff = left && right ? comparePackages(left.package, right.package) : null;
  return (
    <section className="panel">
      <h2>Compare</h2>
      <p>Structured comparison of metadata, weeks, sessions, activities and blocks. History is never edited.</p>
      <div className="toolbar">
        <div>
          <label htmlFor="compare-left">From version</label>
          <select id="compare-left" value={left?.id || ""} onChange={(event) => onLeftChange(event.target.value)}>
            {records.map((item) => (
              <option key={item.id} value={item.id}>{versionLabel(item)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="compare-right">To version</label>
          <select id="compare-right" value={right?.id || ""} onChange={(event) => onRightChange(event.target.value)}>
            {records.map((item) => (
              <option key={item.id} value={item.id}>{versionLabel(item)}</option>
            ))}
          </select>
        </div>
      </div>
      {diff ? (
        <>
          {!hasStructuredChanges(diff) ? <p role="status">These versions are identical in metadata, weeks, sessions, activities and blocks.</p> : null}
          <ChangeTable caption="Metadata" changes={diff.metadata} />
          <EntitySection title="Weeks" items={diff.weeks} />
          <EntitySection title="Sessions" items={diff.sessions} />
          <EntitySection title="Activities" items={diff.activities} />
          <EntitySection title="Blocks" items={diff.blocks} />
        </>
      ) : <p>Select two records to compare.</p>}
    </section>
  );
}
