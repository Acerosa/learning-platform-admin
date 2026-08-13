import { canTransition, LIFECYCLE_LABELS } from "../../content/lifecycle";
import type { AuthoringDraft } from "../../content/types";
import { formatDate } from "../../utils/format";

export function ReviewPanel({
  record,
  actor,
  onAuthorChange,
  onReviewerChange,
  onApprovalNotes,
  onStartReview,
  onApprove,
  onReturnToDraft,
}: {
  record: AuthoringDraft;
  actor: string;
  onAuthorChange: (value: string) => void;
  onReviewerChange: (value: string) => void;
  onApprovalNotes: (value: string) => void;
  onStartReview: () => void;
  onApprove: () => void;
  onReturnToDraft: () => void;
}) {
  return (
    <section className="panel">
      <h2>Review</h2>
      <p>Review happens on the working copy before publication. Returning to Draft is allowed only before a version is published.</p>
      <dl className="authoring-meta">
        <div>
          <dt>Status</dt>
          <dd>{LIFECYCLE_LABELS[record.status]}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDate(record.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDate(record.updatedAt)}</dd>
        </div>
        <div>
          <dt>Review date</dt>
          <dd>{formatDate(record.reviewDate)}</dd>
        </div>
      </dl>
      <div className="authoring-form">
        <div>
          <label htmlFor="review-author">Author</label>
          <input
            id="review-author"
            value={record.author}
            onChange={(event) => onAuthorChange(event.target.value)}
            disabled={record.status === "published" || record.status === "superseded" || record.status === "archived"}
          />
        </div>
        <div>
          <label htmlFor="review-reviewer">Reviewer</label>
          <input
            id="review-reviewer"
            value={record.reviewer}
            placeholder={actor}
            onChange={(event) => onReviewerChange(event.target.value)}
            disabled={record.status === "published" || record.status === "superseded" || record.status === "archived"}
          />
        </div>
        <div>
          <label htmlFor="review-approval-notes">Approval notes</label>
          <textarea
            id="review-approval-notes"
            rows={3}
            value={record.approvalNotes}
            onChange={(event) => onApprovalNotes(event.target.value)}
            disabled={record.status === "published" || record.status === "superseded" || record.status === "archived"}
          />
        </div>
      </div>
      <div className="toolbar">
        <button className="button button--primary" type="button" disabled={!canTransition(record.status, "in-review")} onClick={onStartReview}>
          Start review
        </button>
        <button className="button button--secondary" type="button" disabled={!canTransition(record.status, "approved")} onClick={onApprove}>
          Approve
        </button>
        <button className="button button--secondary" type="button" disabled={!canTransition(record.status, "draft")} onClick={onReturnToDraft}>
          Return to draft
        </button>
      </div>
    </section>
  );
}
