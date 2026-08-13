import { canTransition } from "../../content/lifecycle";
import type { AuthoringDraft, ValidationIssue } from "../../content/types";
import { formatDate } from "../../utils/format";
import { DiagnosticsList } from "./diagnostics-list";

export function PublicationPanel({
  record,
  version,
  notes,
  gateOk,
  issues,
  suggestedVersion,
  onVersionChange,
  onNotesChange,
  onPublish,
}: {
  record: AuthoringDraft;
  version: string;
  notes: string;
  gateOk: boolean;
  issues: readonly ValidationIssue[];
  suggestedVersion: string;
  onVersionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPublish: () => void;
}) {
  const canPublish = canTransition(record.status, "published") && gateOk;
  return (
    <section className="panel">
      <h2>Publication</h2>
      <p>Publishing creates an immutable Admin-local version. It does not write to the backend, commit to GitHub, or update learner hubs.</p>
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
      </div>
      {!gateOk ? <p role="status">Publication is blocked until validation succeeds with a supported schemaVersion and packageVersion.</p> : null}
      <DiagnosticsList issues={issues} />
    </section>
  );
}
