"use client";

import { useMemo, useState } from "react";
import type { AdminDataSnapshot, AttemptRecord, ResponseRecord, ReviewResponseRequest } from "../api/admin-api";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import { getAdminModule } from "../router/modules";
import {
  activityResultSummaries,
  diagnosticsFromResponses,
  feedbackForResponses,
  formatEvidenceValue,
  groupResultSummaries,
  interpretStoredAttempt,
  markbookForGroup,
  progressForLearnerActivity,
  resultsDashboard,
  reviewQueue,
} from "../results/from-admin-snapshot";
import { createEvidenceFromPayload, validateReviewDecision, validateTeacherFeedback } from "@learning-platform/results";
import { formatDate } from "../utils/format";
import { AdminReviewError } from "../services/supabase-admin-service";

type ResultsPane =
  | "dashboard"
  | "groups"
  | "learners"
  | "activities"
  | "attempts"
  | "review"
  | "feedback"
  | "markbook"
  | "diagnostics";

function toneForStatus(status: string): BadgeTone {
  if (["completed", "correct", "automatic", "reviewed"].includes(status)) return "positive";
  if (["requires-review", "needs-marking", "teacher-feedback-required", "awaiting-moderation"].includes(status)) return "warning";
  if (["incorrect"].includes(status)) return "danger";
  return "info";
}

function percentageLabel(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function ResultsMarkbookPage({
  data,
  onReviewResponse,
  embedded = false,
}: {
  data: AdminDataSnapshot;
  onReviewResponse: (request: ReviewResponseRequest) => Promise<unknown>;
  embedded?: boolean;
}) {
  const currentModule = getAdminModule("results");
  const [pane, setPane] = useState<ResultsPane>("dashboard");
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [learnerNumber, setLearnerNumber] = useState<string | null>(null);
  const [activityKey, setActivityKey] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [reviewResponseId, setReviewResponseId] = useState<string | null>(null);
  const [awardedScore, setAwardedScore] = useState("0");
  const [isCorrect, setIsCorrect] = useState<"true" | "false" | "unknown">("unknown");
  const [feedbackSummary, setFeedbackSummary] = useState("");
  const [feedbackNextStep, setFeedbackNextStep] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dashboard = resultsDashboard(data);
  const groups = groupResultSummaries(data);
  const activities = activityResultSummaries(data);
  const markbook = markbookForGroup(data, groupCode);
  const diagnostics = diagnosticsFromResponses(data.responses);
  const queue = reviewQueue(data.responses);
  const selectedAttempt = data.attempts.find((attempt) => attempt.attemptId === attemptId) ?? null;
  const attemptResponses = data.responses.filter((response) => response.attemptId === attemptId);
  const interpreted = selectedAttempt ? interpretStoredAttempt(selectedAttempt, attemptResponses) : null;
  const feedback = feedbackForResponses(attemptResponses.length ? attemptResponses : data.responses);
  const selectedReview = data.responses.find((response) => response.responseId === reviewResponseId) ?? null;

  const learnerRows = useMemo(() => data.learners.map((learner) => {
    const keys = [...new Set(data.attempts.filter((attempt) => attempt.learnerNumber === learner.studentNumber).map((attempt) => attempt.activityKey))];
    const progress = keys.map((key) => progressForLearnerActivity(data, learner.studentNumber, key));
    return { learner, progress };
  }), [data]);

  function openAttempt(attempt: AttemptRecord) {
    setAttemptId(attempt.attemptId);
    setLearnerNumber(attempt.learnerNumber);
    setActivityKey(attempt.activityKey);
    setGroupCode(attempt.groupCode);
    setPane("attempts");
  }

  function openReview(response: ResponseRecord) {
    setReviewResponseId(response.responseId);
    setAttemptId(response.attemptId);
    setLearnerNumber(response.learnerNumber);
    setActivityKey(response.activityKey);
    setGroupCode(response.groupCode);
    setAwardedScore(String(response.score ?? 0));
    setIsCorrect(response.isCorrect === true ? "true" : response.isCorrect === false ? "false" : "unknown");
    setFeedbackSummary(response.feedbackSummary ?? "");
    setFeedbackNextStep(response.feedbackNextStep ?? "");
    setConfirmOpen(false);
    setMessage(null);
    setError(null);
    setPane("review");
  }

  async function submitReview() {
    if (!selectedReview) return;
    setError(null);
    setMessage(null);
    try {
      const decision = validateReviewDecision({
        awardedScore: Number(awardedScore),
        maxScore: selectedReview.maxScore,
        isCorrect: isCorrect === "unknown" ? null : isCorrect === "true",
      });
      const feedback = validateTeacherFeedback({
        summary: feedbackSummary,
        nextStep: feedbackNextStep,
      });
      if (!confirmOpen) {
        setConfirmOpen(true);
        return;
      }
      setBusy(true);
      await onReviewResponse({
        responseId: selectedReview.responseId,
        awardedScore: decision.awardedScore,
        isCorrect: decision.isCorrect,
        feedbackSummary: feedback.summary,
        feedbackNextStep: feedback.nextStep,
      });
      setConfirmOpen(false);
      setMessage("Review saved. Queue, attempt totals and markbook will refresh from the latest snapshot.");
      setReviewResponseId(null);
    } catch (caught) {
      setConfirmOpen(false);
      if (caught instanceof AdminReviewError) {
        setError(caught.message);
      } else if (caught instanceof Error) {
        setError(caught.message.replace(/^REVIEW_[A-Z_]+:\s*/, ""));
      } else {
        setError("The review could not be saved.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {embedded ? null : (
        <header className="page-header">
          <div>
            <p className="eyebrow">{currentModule.eyebrow}</p>
            <h1>{currentModule.label}</h1>
            <p>{currentModule.description}</p>
          </div>
        </header>
      )}
      <p className="eyebrow">Results → {groupCode ?? "Group"} → {learnerNumber ?? "Learner"} → {activityKey ?? "Activity"} → {attemptId ?? "Attempt"} → Evidence → Feedback → Review</p>
      <nav className="toolbar" aria-label="Results sections">
        {(["dashboard", "groups", "learners", "activities", "attempts", "review", "feedback", "markbook", "diagnostics"] as const).map((id) => (
          <button key={id} className={`button button--small ${pane === id ? "button--primary" : "button--secondary"}`} type="button" onClick={() => setPane(id)}>
            {id}
          </button>
        ))}
      </nav>
      {pane === "dashboard" ? (
        <section className="metrics-grid" aria-label="Results summary">
          <article className="metric-card metric-card--info"><div className="metric-card__label">Attempts</div><strong>{dashboard.attemptCount}</strong><p>All stored attempts</p></article>
          <article className="metric-card metric-card--positive"><div className="metric-card__label">Completed</div><strong>{dashboard.completedCount}</strong><p>Completed submissions</p></article>
          <article className="metric-card metric-card--info"><div className="metric-card__label">Average score</div><strong>{percentageLabel(dashboard.averageScore)}</strong><p>Backend completed average</p></article>
          <article className="metric-card metric-card--warning"><div className="metric-card__label">Requires review</div><strong>{dashboard.marking.reviewCount}</strong><p>Pending review</p></article>
          <article className="metric-card"><div className="metric-card__label">Automatically marked</div><strong>{dashboard.marking.automaticCount}</strong><p>Server/imported sources</p></article>
          <article className="metric-card"><div className="metric-card__label">Teacher marked</div><strong>{dashboard.marking.teacherCount}</strong><p>Teacher marking source</p></article>
          <article className="metric-card metric-card--info"><div className="metric-card__label">Latest activity</div><strong>{dashboard.latestActivity ?? "None"}</strong><p>Most recent completed attempt</p></article>
        </section>
      ) : null}
      {pane === "groups" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Cohorts</p><h2>Group results</h2></div></div>
          <div className="table-wrap"><table><thead><tr><th>Group</th><th>Learners</th><th>Completion</th><th>Average</th><th>Highest</th><th>Lowest</th><th>Attempts</th><th>Requires review</th></tr></thead><tbody>
            {groups.map(({ group, summary }) => (
              <tr key={group.groupCode}>
                <th scope="row"><button className="text-link" type="button" onClick={() => { setGroupCode(group.groupCode); setPane("markbook"); }}>{group.groupName}</button><code>{group.groupCode}</code></th>
                <td>{summary.learnerCount}</td>
                <td>{summary.completedCount}</td>
                <td>{percentageLabel(summary.averagePercentage)}</td>
                <td>{percentageLabel(summary.highestPercentage)}</td>
                <td>{percentageLabel(summary.lowestPercentage)}</td>
                <td>{summary.attemptCount}</td>
                <td>{summary.reviewCount}</td>
              </tr>
            ))}
          </tbody></table></div>
        </section>
      ) : null}
      {pane === "learners" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Directory</p><h2>Learner results</h2></div></div>
          <div className="table-wrap"><table><thead><tr><th>Learner</th><th>Assignments</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Progress</th><th>Completion</th><th>Feedback</th></tr></thead><tbody>
            {learnerRows.map(({ learner, progress }) => {
              const latest = progress[0] ?? null;
              return (
                <tr key={learner.studentNumber}>
                  <th scope="row"><code>{learner.displayName}</code><br /><code>{learner.studentNumber}</code></th>
                  <td>{progress.length}</td>
                  <td>{progress.reduce((sum, item) => sum + item.attemptCount, 0)}</td>
                  <td>{percentageLabel(latest?.percentage ?? null)}</td>
                  <td>{latest?.latestAttempt?.attemptNumber ?? "—"}</td>
                  <td>{latest?.completionStatus ?? "not-started"}</td>
                  <td>{progress.filter((item) => item.completionStatus === "completed" || item.completionStatus === "requires-review").length}</td>
                  <td>{progress.some((item) => item.completionStatus === "requires-review") ? "Review" : "Automatic"}</td>
                </tr>
              );
            })}
          </tbody></table></div>
        </section>
      ) : null}
      {pane === "activities" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Curriculum</p><h2>Activity results</h2></div></div>
          <div className="table-wrap"><table><thead><tr><th>Activity</th><th>Attempts</th><th>Average</th><th>Completion</th><th>Questions</th><th>Requires review</th><th>Automatic</th><th>Teacher</th></tr></thead><tbody>
            {activities.map((row) => (
              <tr key={row.activityKey}>
                <th scope="row"><button className="text-link" type="button" onClick={() => { setActivityKey(row.activityKey); setPane("attempts"); }}>{row.activityKey}</button></th>
                <td>{row.summary.attemptCount}</td>
                <td>{percentageLabel(row.summary.averagePercentage)}</td>
                <td>{row.summary.completedCount}</td>
                <td>{row.questionCount}</td>
                <td>{row.marking.reviewCount}</td>
                <td>{row.marking.automaticCount}</td>
                <td>{row.marking.teacherCount}</td>
              </tr>
            ))}
          </tbody></table></div>
        </section>
      ) : null}
      {pane === "attempts" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Evidence</p><h2>Attempts</h2></div></div>
          <div className="table-wrap"><table><thead><tr><th>Learner</th><th>Activity</th><th>Attempt</th><th>Score</th><th>Review</th><th>Completed</th></tr></thead><tbody>
            {data.attempts.map((attempt) => (
              <tr key={attempt.attemptId}>
                <th scope="row"><button className="text-link" type="button" onClick={() => openAttempt(attempt)}><code>{attempt.learnerNumber}</code></button></th>
                <td>{attempt.activityKey}</td>
                <td>{attempt.attemptNumber}</td>
                <td>{attempt.score} / {attempt.maxScore}</td>
                <td><StatusBadge label={attempt.requiresReview ? "requires review" : "marked"} tone={attempt.requiresReview ? "warning" : "positive"} /></td>
                <td>{formatDate(attempt.completedAt)}</td>
              </tr>
            ))}
          </tbody></table></div>
          {selectedAttempt && interpreted ? (
            <div className="notice-card notice-card--info">
              <strong>Attempt detail</strong>
              <p>{selectedAttempt.learnerNumber} · {selectedAttempt.activityKey} · score {interpreted.score} / {interpreted.maxScore} · {interpreted.markingSource}</p>
              <ul>
                {attemptResponses.map((response) => {
                  const evidence = createEvidenceFromPayload(response.questionKey, response.questionType, response.responsePayload);
                  return (
                    <li key={response.responseId}>
                      <button className="text-link" type="button" onClick={() => openReview(response)}>
                        <code>{response.questionKey}</code>
                      </button>
                      {" "}· {evidence.evidenceType} · {formatEvidenceValue(evidence.value)} · {response.requiresReview ? "review" : response.isCorrect == null ? "unmarked" : response.isCorrect ? "correct" : "incorrect"}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <p>Select an attempt to inspect evidence, result and feedback.</p>}
        </section>
      ) : null}
      {pane === "review" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Queue</p><h2>Requires review</h2></div><span className="count-chip">{queue.length}</span></div>
          {queue.length ? <div className="table-wrap"><table><thead><tr><th>Learner</th><th>Activity</th><th>Question</th><th>Reason</th><th>Action</th></tr></thead><tbody>
            {queue.map((item) => (
              <tr key={item.responseId}>
                <th scope="row"><code>{item.learnerNumber}</code></th>
                <td>{item.activityKey}</td>
                <td>{item.questionKey}</td>
                <td><StatusBadge label={item.reason} tone={toneForStatus(item.reason)} /></td>
                <td>
                  <button
                    className="button button--small button--secondary"
                    type="button"
                    onClick={() => {
                      const response = data.responses.find((entry) => entry.responseId === item.responseId);
                      if (response) openReview(response);
                    }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody></table></div> : <p>No responses currently require review.</p>}

          {selectedReview ? (
            <section className="panel" aria-label="Review detail">
              <div className="panel__header"><div><p className="eyebrow">Teacher judgement</p><h2>Review detail</h2></div></div>
              <p>
                <code>{selectedReview.learnerNumber}</code> · {selectedReview.groupCode} · {selectedReview.activityKey} · {selectedReview.questionKey}
              </p>
              <p>
                Evidence: {formatEvidenceValue(createEvidenceFromPayload(selectedReview.questionKey, selectedReview.questionType, selectedReview.responsePayload).value)}
              </p>
              <p>
                Current result: {selectedReview.score ?? "—"} / {selectedReview.maxScore}
                {" · "}
                {selectedReview.isCorrect == null ? "unknown correctness" : selectedReview.isCorrect ? "correct" : "incorrect"}
                {" · "}
                {selectedReview.markingSource}
                {" · "}
                {selectedReview.requiresReview ? "requires review" : "reviewed"}
              </p>
              <div className="toolbar">
                <label htmlFor="review-score">Awarded score</label>
                <input
                  id="review-score"
                  type="number"
                  min={0}
                  max={selectedReview.maxScore}
                  step="0.01"
                  value={awardedScore}
                  onChange={(event) => { setConfirmOpen(false); setAwardedScore(event.target.value); }}
                />
                <label htmlFor="review-correctness">Correctness</label>
                <select
                  id="review-correctness"
                  value={isCorrect}
                  onChange={(event) => { setConfirmOpen(false); setIsCorrect(event.target.value as typeof isCorrect); }}
                >
                  <option value="unknown">Not applicable / unknown</option>
                  <option value="true">Correct</option>
                  <option value="false">Incorrect</option>
                </select>
              </div>
              <label htmlFor="review-feedback">Feedback</label>
              <textarea
                id="review-feedback"
                rows={4}
                value={feedbackSummary}
                onChange={(event) => { setConfirmOpen(false); setFeedbackSummary(event.target.value); }}
              />
              <label htmlFor="review-next-step">Next step</label>
              <input
                id="review-next-step"
                type="text"
                value={feedbackNextStep}
                onChange={(event) => { setConfirmOpen(false); setFeedbackNextStep(event.target.value); }}
              />
              {confirmOpen ? (
                <section className="notice-card notice-card--warning">
                  <strong>Confirm review</strong>
                  <p>
                    Save score {awardedScore} / {selectedReview.maxScore} with teacher feedback and clear requires-review for this response?
                    Evidence payload will not change.
                  </p>
                </section>
              ) : null}
              {error ? <section className="notice-card notice-card--danger"><strong>Review failed</strong><p>{error}</p></section> : null}
              {message ? <section className="notice-card notice-card--positive"><strong>Review complete</strong><p>{message}</p></section> : null}
              <div className="toolbar">
                <button className="button button--primary" type="button" disabled={busy} onClick={() => void submitReview()}>
                  {confirmOpen ? (busy ? "Saving…" : "Confirm and complete review") : "Review and continue"}
                </button>
                {confirmOpen ? (
                  <button className="button button--secondary" type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>
                    Cancel confirmation
                  </button>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="notice-card notice-card--info">
              <strong>Open a queue item</strong>
              <p>Inspect evidence, award a score within the question maximum, add feedback, then confirm to complete the review.</p>
            </section>
          )}
        </section>
      ) : null}
      {pane === "feedback" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Comments</p><h2>Feedback</h2></div></div>
          <p>{feedback.summary ?? "No teacher feedback is stored yet. Automatic summaries are shown from marks."}</p>
          <ul>
            {feedback.teacher.map((item) => (
              <li key={`teacher-${item.questionKey}-${item.summary}`}><code>{item.questionKey}</code> · Teacher · {item.summary}{item.nextSteps.length ? ` · Next: ${item.nextSteps.join("; ")}` : ""}</li>
            ))}
            {feedback.automatic.map((item) => (
              <li key={`auto-${item.questionKey}-${item.summary}`}><code>{item.questionKey}</code> · Automatic · {item.summary}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {pane === "markbook" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Grid</p><h2>Markbook {groupCode ? `· ${groupCode}` : ""}</h2></div>
            <label htmlFor="markbook-group">Group</label>
            <select id="markbook-group" value={groupCode ?? ""} onChange={(event) => setGroupCode(event.target.value || null)}>
              <option value="">All groups</option>
              {data.groups.map((group) => <option key={group.groupCode} value={group.groupCode}>{group.groupName}</option>)}
            </select>
          </div>
          <p>Learners {markbook.summary.learnerCount} · Activities {markbook.summary.activityCount} · Completed {markbook.summary.completedCount} · Review {markbook.summary.reviewCount}</p>
          <div className="table-wrap"><table><thead><tr><th>Learner</th><th>Activity</th><th>Attempts</th><th>Best</th><th>Status</th></tr></thead><tbody>
            {markbook.rows.map((row) => (
              <tr key={`${row.learner.id}-${row.activity.key}`}>
                <th scope="row"><code>{row.learner.learnerNumber}</code></th>
                <td>{row.activity.key}</td>
                <td>{row.progress.attemptCount}</td>
                <td>{percentageLabel(row.progress.percentage)}</td>
                <td><StatusBadge label={row.progress.completionStatus} tone={toneForStatus(row.progress.completionStatus)} /></td>
              </tr>
            ))}
          </tbody></table></div>
        </section>
      ) : null}
      {pane === "diagnostics" ? (
        <section className="panel">
          <div className="panel__header"><div><p className="eyebrow">Existing mappings only</p><h2>Diagnostics</h2></div></div>
          {!data.responses.length ? <p>No question-level responses are available, so diagnostics are not invented.</p> : (
            <>
              <p>Strengths: {diagnostics.strengths.join(", ") || "None yet"}</p>
              <p>Weaknesses: {diagnostics.weaknesses.join(", ") || "None yet"}</p>
              <div className="table-wrap"><table><thead><tr><th>Topic</th><th>Percentage</th></tr></thead><tbody>
                {diagnostics.topics.map((topic) => <tr key={topic.key}><th scope="row">{topic.label}</th><td>{percentageLabel(topic.percentage)}</td></tr>)}
              </tbody></table></div>
              <div className="table-wrap"><table><thead><tr><th>Skill</th><th>Percentage</th></tr></thead><tbody>
                {diagnostics.skills.map((skill) => <tr key={skill.key}><th scope="row">{skill.label}</th><td>{percentageLabel(skill.percentage)}</td></tr>)}
              </tbody></table></div>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
