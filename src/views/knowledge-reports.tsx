"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import {
  DEMO_KNOWLEDGE_REPORTS,
  DEMO_KNOWLEDGE_REPORT_TEXT,
  EMPTY_KNOWLEDGE_REPORT_FILTERS,
  canOpenReport,
  cascadeKnowledgeReportFilters,
  filterKnowledgeReports,
  formatElapsed,
  knowledgeReportRpcParams,
  mapKnowledgeReportContentReview,
  mapKnowledgeReportRow,
  CONTENT_REVIEW_ADVISORY,
  coverageLabel,
  minimumEvidenceLabel,
  minimumLabel,
  missingLabel,
  relevanceLabel,
  reportTextFromEvidence,
  reviewLabel,
  statusLabel,
  submissionMethodLabel,
  uniqueOptions,
  wordBandNote,
  type KnowledgeReportContentReview,
  type KnowledgeReportFilters,
  type KnowledgeReportRow,
  type KnowledgeReportStatus,
} from "../results/knowledge-reports";
import {
  buildCohortKnowledgeReportPdf,
  buildIndividualKnowledgeReportPdf,
  downloadPdf,
} from "../results/knowledge-report-pdf.ts";
import { useAdminPortal } from "../stores/admin-portal";
import { formatDateTime } from "../utils/format";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state" data-testid="knowledge-report-empty">
      <span className="empty-state__mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function statusTone(status: KnowledgeReportStatus): BadgeTone {
  if (status === "reviewed") return "positive";
  if (status === "submitted" || status === "in_progress" || status === "time_elapsed") return "warning";
  return "neutral";
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="toolbar__search">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

export function KnowledgeReportsPage({ hubCode }: { hubCode: string }) {
  const { callRpc, dataSource } = useAdminPortal();
  const live = dataSource.mode === "live" && dataSource.state === "ready";
  const [filters, setFilters] = useState<KnowledgeReportFilters>(EMPTY_KNOWLEDGE_REPORT_FILTERS);
  const [rows, setRows] = useState<KnowledgeReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KnowledgeReportRow | null>(null);
  const [reportText, setReportText] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [contentReview, setContentReview] = useState<KnowledgeReportContentReview | null>(null);
  const [storedFeedback, setStoredFeedback] = useState<string | null>(null);

  const cascaded = useMemo(() => cascadeKnowledgeReportFilters(rows, filters), [filters, rows]);
  const visible = useMemo(() => filterKnowledgeReports(rows, cascaded), [cascaded, rows]);
  const courses = useMemo(() => uniqueOptions(rows, "courseKey", (row) => row.courseKey), [rows]);
  const groups = useMemo(
    () => uniqueOptions(rows.filter((row) => !cascaded.courseKey || row.courseKey === cascaded.courseKey), "groupCode", (row) => row.groupName),
    [cascaded.courseKey, rows],
  );
  const learners = useMemo(
    () => uniqueOptions(
      rows.filter((row) => (
        (!cascaded.courseKey || row.courseKey === cascaded.courseKey)
        && (!cascaded.groupCode || row.groupCode === cascaded.groupCode)
      )),
      "studentNumber",
      (row) => row.learnerName,
    ),
    [cascaded.courseKey, cascaded.groupCode, rows],
  );
  const reports = useMemo(
    () => uniqueOptions(rows, "activityKey", (row) => row.reportTitle),
    [rows],
  );

  const updateFilter = useCallback((patch: Partial<KnowledgeReportFilters>) => {
    setSelected(null);
    setReportText("");
    setFilters((current) => cascadeKnowledgeReportFilters(rows, { ...current, ...patch }));
  }, [rows]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!live) {
        setRows(DEMO_KNOWLEDGE_REPORTS);
        return;
      }
      const params = knowledgeReportRpcParams(hubCode, EMPTY_KNOWLEDGE_REPORT_FILTERS);
      let loaded = await callRpc("list_knowledge_report_cohort", params);
      const missing = loaded.map(mapKnowledgeReportRow).filter((row) => row.responseId && !row.overallRelevance);
      if (missing.length > 0) {
        await Promise.all(missing.map((row) => callRpc("ensure_knowledge_report_content_review", {
          p_response_id: row.responseId,
        })));
        loaded = await callRpc("list_knowledge_report_cohort", params);
      }
      setRows(loaded.map(mapKnowledgeReportRow));
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "Unable to load knowledge reports.");
    } finally {
      setLoading(false);
    }
  }, [callRpc, hubCode, live]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function openRow(row: KnowledgeReportRow) {
    if (!canOpenReport(row)) return;
    setSelected(row);
    setFeedback("");
    setStoredFeedback(null);
    setContentReview(null);
    setReviewError(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      if (!live) {
        setReportText(DEMO_KNOWLEDGE_REPORT_TEXT);
        setContentReview(row.overallRelevance ? {
          analysisVersion: "1",
          overallRelevance: row.overallRelevance,
          summary: "Demo content review for this submitted report.",
          topics: [{ key: "cia", label: "CIA Triad", coverage: "demonstrated", reason: "Demo coverage." }],
          repetitionFlag: row.repetitionFlag === true,
          repetitionNote: row.repetitionFlag ? "Possible excessive repetition" : null,
        } : null);
        return;
      }
      const [evidence, review] = await Promise.all([
        callRpc("list_hub_learning_result_evidence", {
          p_hub_code: hubCode,
          p_student_number: row.studentNumber,
          p_assignment_id: row.assignmentId,
        }),
        row.responseId
          ? callRpc("ensure_knowledge_report_content_review", { p_response_id: row.responseId })
          : Promise.resolve([]),
      ]);
      setReportText(reportTextFromEvidence(evidence));
      const feedbackRow = evidence.find((item) => {
        const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return typeof record.feedback_summary === "string" && record.feedback_summary.trim();
      }) as Record<string, unknown> | undefined;
      setStoredFeedback(typeof feedbackRow?.feedback_summary === "string" ? feedbackRow.feedback_summary : null);
      setContentReview(review[0] ? mapKnowledgeReportContentReview(review[0]) : null);
    } catch (cause) {
      setReportText("");
      setDetailError(cause instanceof Error ? cause.message : "Unable to load the submitted report.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function downloadStudent() {
    if (!selected || !reportText) return;
    const bytes = await buildIndividualKnowledgeReportPdf({
      row: selected,
      reportText,
      contentReview,
      teacherFeedback: storedFeedback || feedback || null,
      reviewedBy: null,
      generatedAt: new Date(),
    });
    downloadPdf(bytes, `${selected.studentNumber}-knowledge-report.pdf`);
  }

  async function downloadCohort() {
    const bytes = await buildCohortKnowledgeReportPdf({
      title: visible[0]?.reportTitle ?? "Knowledge Reports",
      groupLabel: cascaded.groupCode || "All visible groups",
      rows: visible,
      generatedAt: new Date(),
    });
    downloadPdf(bytes, "knowledge-report-cohort.pdf");
  }

  async function markReviewed() {
    if (!selected?.responseId || !feedback.trim()) {
      setReviewError("Add feedback before marking the report as reviewed.");
      return;
    }
    setReviewing(true);
    setReviewError(null);
    try {
      if (live) {
        await callRpc("review_knowledge_report", {
          p_response_id: selected.responseId,
          p_feedback_summary: feedback.trim(),
        });
      }
      const reviewed: KnowledgeReportRow = {
        ...selected,
        completionStatus: "reviewed",
        requiresReview: false,
        reviewedAt: new Date().toISOString(),
      };
      setRows((current) => current.map((row) => (
        row.responseId === selected.responseId ? { ...row, ...reviewed } : row
      )));
      setSelected(reviewed);
      if (live) void loadRows();
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : "Unable to save the review.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div data-testid="knowledge-reports">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Results → Knowledge Reports</p>
            <h2>Knowledge Reports</h2>
            <p>
              Assigned learners for each timed knowledge report. Word count and time used are evidence.
              The teacher decides what that evidence means.
            </p>
          </div>
        </div>
        <div className="toolbar" data-testid="knowledge-report-filters">
          <FilterSelect id="knowledge-report-course" label="Course" value={cascaded.courseKey} options={courses} onChange={(value) => updateFilter({ courseKey: value, groupCode: "", studentNumber: "" })} />
          <FilterSelect id="knowledge-report-group" label="Group" value={cascaded.groupCode} options={groups} onChange={(value) => updateFilter({ groupCode: value, studentNumber: "" })} />
          <FilterSelect id="knowledge-report-learner" label="Learner" value={cascaded.studentNumber} options={learners} onChange={(value) => updateFilter({ studentNumber: value })} />
          <FilterSelect id="knowledge-report-activity" label="Knowledge Report" value={cascaded.activityKey} options={reports} onChange={(value) => updateFilter({ activityKey: value })} />
          <FilterSelect
            id="knowledge-report-status"
            label="Status"
            value={cascaded.completionStatus}
            options={[
              { value: "not_started", label: "Not started" },
              { value: "in_progress", label: "In progress" },
              { value: "time_elapsed", label: "Time elapsed - awaiting finalisation" },
              { value: "submitted", label: "Submitted" },
              { value: "reviewed", label: "Reviewed" },
            ]}
            onChange={(value) => updateFilter({ completionStatus: value })}
          />
          <FilterSelect
            id="knowledge-report-minimum"
            label="Minimum"
            value={cascaded.minimumMet}
            options={[
              { value: "met", label: "Met" },
              { value: "not_reached", label: "Not reached" },
            ]}
            onChange={(value) => updateFilter({ minimumMet: value })}
          />
          <FilterSelect
            id="knowledge-report-review"
            label="Review"
            value={cascaded.reviewStatus}
            options={[
              { value: "needs_review", label: "Needs review" },
              { value: "reviewed", label: "Reviewed" },
            ]}
            onChange={(value) => updateFilter({ reviewStatus: value })}
          />
          <FilterSelect
            id="knowledge-report-relevance"
            label="Relevance"
            value={cascaded.relevance}
            options={[
              { value: "high", label: "High" },
              { value: "moderate", label: "Moderate" },
              { value: "low", label: "Low" },
              { value: "very_low", label: "Very low" },
            ]}
            onChange={(value) => updateFilter({ relevance: value })}
          />
        </div>
      </section>

      {loading ? <section className="panel"><p data-testid="knowledge-report-loading">Loading knowledge reports…</p></section> : null}
      {error ? (
        <section className="panel">
          <div className="empty-state" data-testid="knowledge-report-error">
            <span className="empty-state__mark" aria-hidden="true">!</span>
            <h3>Unable to load knowledge reports</h3>
            <p>{error}</p>
          </div>
        </section>
      ) : null}
      {!loading && !error && visible.length === 0 ? (
        <section className="panel">
          <EmptyState title="No knowledge reports in this selection" body="There is no assigned learner matching these filters." />
        </section>
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Assigned cohort</p>
              <h2>Knowledge Reports</h2>
            </div>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => void downloadCohort()}
            >
              Download Cohort PDF
            </button>
          </div>
          <div className="table-wrap">
            <table data-testid="knowledge-report-cohort">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Report</th>
                  <th>Status</th>
                  <th>Words</th>
                  <th>Target</th>
                  <th>Time</th>
                  <th>Submission</th>
                  <th>Relevance</th>
                  <th>Review</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={`${row.studentNumber}:${row.assignmentId}`}>
                    <th scope="row">
                      {row.learnerName}
                      <br />
                      <code>{row.studentNumber}</code>
                    </th>
                    <td>{row.reportTitle}</td>
                    <td><StatusBadge label={statusLabel(row.completionStatus)} tone={statusTone(row.completionStatus)} /></td>
                    <td>{missingLabel(row.wordCount)}</td>
                    <td>{minimumLabel(row.minimumMet)}</td>
                    <td>{formatElapsed(row.elapsedSeconds)}</td>
                    <td>{submissionMethodLabel(row.submissionMethod)}</td>
                    <td>{relevanceLabel(row.overallRelevance)}</td>
                    <td>{reviewLabel(row)}</td>
                    <td>
                      {canOpenReport(row) ? (
                        <button className="button button--small button--secondary" type="button" onClick={() => void openRow(row)}>
                          Open
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selected ? (
        <section className="panel" data-testid="knowledge-report-detail">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{selected.groupName}</p>
              <h2>{selected.learnerName}</h2>
              <p>{selected.reportTitle}</p>
            </div>
          </div>
          <dl className="detail-list">
            <div><dt>Words</dt><dd>{missingLabel(selected.wordCount)}</dd></div>
            <div><dt>Minimum required</dt><dd>{missingLabel(selected.minimumWords)}</dd></div>
            <div><dt>Minimum</dt><dd>{minimumEvidenceLabel(selected.minimumMet, selected.wordCount)}</dd></div>
            <div><dt>Configured duration</dt><dd>{formatElapsed(selected.durationSeconds)}</dd></div>
            <div><dt>Time used</dt><dd>{formatElapsed(selected.elapsedSeconds)}</dd></div>
            <div><dt>Submission</dt><dd>{submissionMethodLabel(selected.submissionMethod)}</dd></div>
            <div><dt>Submitted</dt><dd>{selected.submittedAt ? formatDateTime(selected.submittedAt) : "—"}</dd></div>
            <div><dt>Review</dt><dd>{reviewLabel(selected)}</dd></div>
          </dl>
          {wordBandNote(selected.wordCount) ? <p>{wordBandNote(selected.wordCount)}</p> : null}
          <div>
            <button className="button button--secondary" type="button" onClick={() => void downloadStudent()}>
              Download Student PDF
            </button>
          </div>
          {contentReview ? (
            <section data-testid="knowledge-report-content-review">
              <h3>Advisory Content Review</h3>
              <p>Task relevance: {relevanceLabel(contentReview.overallRelevance)}</p>
              <p>{contentReview.summary}</p>
              <h4>Advisory Topic Coverage</h4>
              <ul>
                {contentReview.topics.map((topic) => (
                  <li key={topic.key}>{topic.label} — {coverageLabel(topic.coverage)}</li>
                ))}
              </ul>
              {contentReview.repetitionNote ? <p>{contentReview.repetitionNote}</p> : <p>Flags: None</p>}
              <p>{CONTENT_REVIEW_ADVISORY}</p>
            </section>
          ) : null}
          <h3>Student Report</h3>
          {detailLoading ? <p data-testid="knowledge-report-detail-loading">Loading the submitted report…</p> : null}
          {detailError ? <p data-testid="knowledge-report-detail-error">{detailError}</p> : null}
          {reportText ? (
            <article
              data-testid="knowledge-report-text"
              style={{ maxWidth: "42rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}
            >
              {reportText}
            </article>
          ) : null}
          {selected.requiresReview ? (
            <form
              data-testid="knowledge-report-review"
              onSubmit={(event) => {
                event.preventDefault();
                void markReviewed();
              }}
            >
              <h3>Teacher review</h3>
              <label htmlFor="knowledge-report-feedback">Feedback / notes</label>
              <textarea
                id="knowledge-report-feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={5}
              />
              {reviewError ? <p>{reviewError}</p> : null}
              <button className="button" type="submit" disabled={reviewing}>Mark as reviewed</button>
            </form>
          ) : (
            <p data-testid="knowledge-report-reviewed">Reviewed{feedback ? ` · ${feedback}` : ""}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
