import { LIFECYCLE_LABELS } from "../../content/lifecycle";
import type { AuthoringDraft } from "../../content/types";
import { formatDate } from "../../utils/format";
import { StatusBadge } from "../status-badge";
import { lifecycleTone } from "./lifecycle-banner";

export function HistoryPanel({
  records,
  current,
  onView,
  onCompare,
  onRestore,
}: {
  records: readonly AuthoringDraft[];
  current: AuthoringDraft;
  onView: (record: AuthoringDraft) => void;
  onCompare: (record: AuthoringDraft) => void;
  onRestore: (record: AuthoringDraft) => void;
}) {
  const history = records.filter((item) => item.hubId === current.hubId && item.courseKey === current.courseKey);
  return (
    <section className="panel">
      <h2>History</h2>
      <p>History is read-only. Restore as Draft creates a new working copy and never edits a published snapshot.</p>
      {history.length ? (
        <div className="table-wrap" aria-label="Curriculum version history">
          <table>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Published</th>
                <th scope="col">Author</th>
                <th scope="col">Reviewer</th>
                <th scope="col">Notes</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.version || "working copy"}</th>
                  <td><StatusBadge label={LIFECYCLE_LABELS[item.status]} tone={lifecycleTone(item.status)} /></td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{formatDate(item.publishedAt)}</td>
                  <td>{item.author}</td>
                  <td>{item.reviewer || "—"}</td>
                  <td>{item.publicationNotes || item.approvalNotes || "—"}</td>
                  <td>
                    <div className="toolbar">
                      <button className="button button--small button--secondary" type="button" onClick={() => onView(item)}>View</button>
                      <button className="button button--small button--secondary" type="button" onClick={() => onCompare(item)}>Compare</button>
                      <button className="button button--small button--secondary" type="button" onClick={() => onRestore(item)}>Restore as Draft</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>No history for this hub and course.</p>}
    </section>
  );
}
