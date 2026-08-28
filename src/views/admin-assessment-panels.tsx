"use client";

import type { AdminDataSnapshot } from "../api/admin-api";
import type { PendingAction } from "../components/pending-action-dialog";
import { StatusBadge } from "../components/status-badge";
import { ResultsMarkbookPage } from "./results-markbook";
import { formatDate } from "../utils/format";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function toneForStatus(status: string) {
  if (["active", "completed", "succeeded", "published", "pass"].includes(status)) return "positive" as const;
  if (["partial", "draft", "ready-for-review", "in-review", "approved", "warn"].includes(status)) return "warning" as const;
  if (["unavailable", "failed", "inactive", "denied", "fail"].includes(status)) return "danger" as const;
  return "neutral" as const;
}

function scoreLabel(score: number, maxScore: number) {
  return `${score} / ${maxScore}`;
}

export function AssignmentsPanel({
  data,
  openPending,
}: {
  data: AdminDataSnapshot;
  openPending: (action: PendingAction) => void;
}) {
  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <div><p className="eyebrow">Learning delivery</p><h2>Assignments</h2></div>
          <button className="button button--primary" type="button" onClick={() => openPending({ title: "Create an assignment" })}>
            <span aria-hidden="true">＋</span> Create assignment
          </button>
        </div>
        {data.assignments.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Activity</th><th scope="col">Version</th><th scope="col">Group</th><th scope="col">Opens</th><th scope="col">Due</th><th scope="col">Required</th><th scope="col">Status</th></tr></thead>
              <tbody>{data.assignments.map((assignment, index) => (
                <tr key={`${assignment.groupCode}-${assignment.activityKey}-${index}`}>
                  <th scope="row"><code>{assignment.activityKey}</code></th>
                  <td>{assignment.activityVersion}</td>
                  <td>{assignment.groupCode}</td>
                  <td>{assignment.opensAt ? formatDate(assignment.opensAt) : "Always available"}</td>
                  <td>{formatDate(assignment.dueAt)}</td>
                  <td>{assignment.required ? "Yes" : "No"}</td>
                  <td><StatusBadge label={assignment.active ? "active" : "inactive"} tone={assignment.active ? "positive" : "neutral"} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No assignments" body="No assignment records are visible." />}
      </section>
      <section className="notice-card notice-card--warning"><strong>Mutation workflow pending</strong><p>Assignment creation remains disabled until an audited, idempotent backend RPC is approved.</p></section>
    </>
  );
}

export function ResultsPanel({
  data,
  onReviewResponse,
  includeAttempts = false,
}: {
  data: AdminDataSnapshot;
  onReviewResponse: Parameters<typeof ResultsMarkbookPage>[0]["onReviewResponse"];
  includeAttempts?: boolean;
}) {
  return (
    <>
      <ResultsMarkbookPage data={data} onReviewResponse={onReviewResponse} embedded />
      {includeAttempts ? (
        <section className="panel">
          <div className="panel__header">
            <div><p className="eyebrow">Summary evidence only</p><h2>Attempt history</h2></div>
            <span className="count-chip">{data.attempts.length} records</span>
          </div>
          {data.attempts.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th scope="col">Learner</th><th scope="col">Group</th><th scope="col">Activity</th><th scope="col">Attempt</th><th scope="col">Score</th><th scope="col">Marking</th><th scope="col">Evidence</th><th scope="col">Completed</th><th scope="col">Status</th></tr></thead>
                <tbody>{data.attempts.map((attempt) => (
                  <tr key={attempt.attemptId}>
                    <th scope="row"><code>{attempt.learnerNumber}</code></th>
                    <td>{attempt.groupCode}</td>
                    <td><span className="table-primary">{attempt.activityKey}</span><small>{attempt.activityVersion}</small></td>
                    <td>{attempt.attemptNumber}</td>
                    <td>{scoreLabel(attempt.score, attempt.maxScore)}</td>
                    <td>{attempt.markingSource}</td>
                    <td>{attempt.evidenceLevel.replaceAll("_", " ")}</td>
                    <td>{formatDate(attempt.completedAt)}</td>
                    <td><StatusBadge label={attempt.status} tone={toneForStatus(attempt.status)} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="No attempts" body="No summary-level attempt records are available." />}
          <section className="notice-card notice-card--info"><strong>Response payloads excluded</strong><p>This list intentionally reads no learner response content. Use the markbook above for group → learner drill-down.</p></section>
        </section>
      ) : null}
    </>
  );
}
