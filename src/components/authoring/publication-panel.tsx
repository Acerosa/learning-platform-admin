import type { CurriculumPublicationRecord } from "../../api/admin-api";
import { canTransition } from "../../content/lifecycle";
import type { AuthoringDraft, ValidationIssue } from "../../content/types";
import { formatDate } from "../../utils/format";
import { DiagnosticsList } from "./diagnostics-list";

const PLATFORM_STATE_LABELS = {
  idle: "Not sent",
  pending: "Pending",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
} as const;

export function PublicationPanel({
  record,
  version,
  notes,
  gateOk,
  issues,
  suggestedVersion,
  publications,
  platformAvailable,
  onVersionChange,
  onNotesChange,
  onPublish,
  onPublishToPlatform,
}: {
  record: AuthoringDraft;
  version: string;
  notes: string;
  gateOk: boolean;
  issues: readonly ValidationIssue[];
  suggestedVersion: string;
  publications: readonly CurriculumPublicationRecord[];
  platformAvailable: boolean;
  onVersionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPublish: () => void;
  onPublishToPlatform: () => void;
}) {
  const canPublish = canTransition(record.status, "published") && gateOk;
  const canPublishToPlatform = record.status === "published"
    && record.platformPublicationState !== "publishing"
    && record.platformPublicationState !== "published"
    && platformAvailable;
  const history = publications.filter(
    (item) => item.hubCode === record.hubId && item.courseKey === record.courseKey,
  );

  return (
    <section className="panel">
      <h2>Publication</h2>
      <p>Local Publish freezes an immutable Admin snapshot. Publish to Platform stores that snapshot in Supabase. Learner hubs load it from there. A GitHub commit or Pages redeploy is not required for curriculum changes.</p>
      <dl className="authoring-meta">
        <div>
          <dt>Version</dt>
          <dd>{record.version || "Not published"}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{formatDate(record.publishedAt)}</dd>
        </div>
        <div>
          <dt>Published by</dt>
          <dd>{record.publishedBy || "—"}</dd>
        </div>
        <div>
          <dt>Source package version</dt>
          <dd>{record.sourcePackageVersion}</dd>
        </div>
        <div>
          <dt>Schema version</dt>
          <dd>{record.schemaVersion}</dd>
        </div>
        <div>
          <dt>Platform</dt>
          <dd>{PLATFORM_STATE_LABELS[record.platformPublicationState]}</dd>
        </div>
      </dl>
      <div className="authoring-form">
        <div>
          <label htmlFor="publication-version">New version</label>
          <input
            id="publication-version"
            value={version}
            onChange={(event) => onVersionChange(event.target.value)}
            placeholder={suggestedVersion}
            disabled={!canTransition(record.status, "published")}
          />
        </div>
        <div>
          <label htmlFor="publication-notes">Publication notes</label>
          <textarea
            id="publication-notes"
            rows={3}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            disabled={!canTransition(record.status, "published")}
          />
        </div>
      </div>
      <div className="toolbar">
        <button className="button button--primary" type="button" disabled={!canPublish} onClick={onPublish}>
          Publish immutable version
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={!canPublishToPlatform}
          onClick={onPublishToPlatform}
        >
          Publish to Platform
        </button>
      </div>
      {!gateOk ? <p role="status">Publication is blocked until validation succeeds with a supported schemaVersion and packageVersion.</p> : null}
      {record.status === "published" && !platformAvailable ? (
        <p role="status">Publish to Platform requires a live administrator session.</p>
      ) : null}
      {record.platformPublicationError ? <p role="alert">{record.platformPublicationError}</p> : null}
      {record.platformPublicationState === "published" ? (
        <p role="status">Learner hubs load this published package from Supabase. A GitHub Pages redeploy is not required for curriculum changes.</p>
      ) : null}
      <DiagnosticsList issues={issues} />
      <h3>Platform publication history</h3>
      {history.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Schema</th>
                <th scope="col">Package</th>
                <th scope="col">Author</th>
                <th scope="col">Reviewer</th>
                <th scope="col">Published by</th>
                <th scope="col">Published</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <th scope="row"><code>{item.packageVersion}</code></th>
                  <td>{item.status === "published" ? "Published" : "Superseded"}</td>
                  <td>{item.schemaVersion}</td>
                  <td>{item.sourcePackageVersion}</td>
                  <td>{item.author}</td>
                  <td>{item.reviewer || "—"}</td>
                  <td>{item.publishedBy}</td>
                  <td>{formatDate(item.publishedAt)}</td>
                  <td>{item.publicationNotes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No platform publications for this curriculum yet.</p>
      )}
    </section>
  );
}
