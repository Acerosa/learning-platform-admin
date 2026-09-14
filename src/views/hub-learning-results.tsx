"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import {
  DEMO_HUB_LEARNING_EVIDENCE,
  DEMO_HUB_LEARNING_FILTERS,
  DEMO_HUB_LEARNING_RESULTS,
  DEMO_HUB_LEARNING_SUMMARY,
  EMPTY_HUB_LEARNING_FILTERS,
  EMPTY_HUB_LEARNING_SUMMARY,
  cascadeHubLearningFilters,
  completionLabel,
  countsLabel,
  hubLearningRpcParams,
  mapHubLearningEvidenceRow,
  mapHubLearningFilterRow,
  mapHubLearningResultRow,
  mapHubLearningSummary,
  percentageLabel,
  scoreLabel,
  sourceLabel,
  uniqueActivities,
  uniqueCourses,
  uniqueGroups,
  uniqueLearners,
  uniqueSessions,
  uniqueWeeks,
  type HubLearningEvidenceRow,
  type HubLearningFilterRow,
  type HubLearningFilters,
  type HubLearningResultRow,
  type HubLearningSummary,
} from "../results/hub-learning";
import { formatEvidenceValue } from "../results/from-admin-snapshot";
import { useAdminPortal } from "../stores/admin-portal";
import { formatDateTime } from "../utils/format";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state" data-testid="hub-learning-empty">
      <span className="empty-state__mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function statusTone(status: string): BadgeTone {
  if (status === "Completed") return "positive";
  if (status === "In progress") return "warning";
  return "neutral";
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="toolbar__search">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled || options.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function HubLearningResultsPage({
  hubCode,
  label,
}: {
  hubCode: string;
  label: string;
}) {
  const { callRpc, dataSource } = useAdminPortal();
  const live = dataSource.mode === "live" && dataSource.state === "ready";

  const [filters, setFilters] = useState<HubLearningFilters>(EMPTY_HUB_LEARNING_FILTERS);
  const [filterRows, setFilterRows] = useState<HubLearningFilterRow[]>([]);
  const [results, setResults] = useState<HubLearningResultRow[]>([]);
  const [summary, setSummary] = useState<HubLearningSummary>(EMPTY_HUB_LEARNING_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HubLearningResultRow | null>(null);
  const [evidence, setEvidence] = useState<HubLearningEvidenceRow[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const cascaded = useMemo(
    () => cascadeHubLearningFilters(filterRows, filters),
    [filterRows, filters],
  );
  const courses = useMemo(() => uniqueCourses(filterRows), [filterRows]);
  const groups = useMemo(() => uniqueGroups(filterRows, cascaded.courseKey), [cascaded.courseKey, filterRows]);
  const learners = useMemo(() => uniqueLearners(filterRows, cascaded), [cascaded, filterRows]);
  const weeks = useMemo(() => uniqueWeeks(filterRows, cascaded), [cascaded, filterRows]);
  const sessions = useMemo(() => uniqueSessions(filterRows, cascaded), [cascaded, filterRows]);
  const activities = useMemo(() => uniqueActivities(filterRows, cascaded), [cascaded, filterRows]);

  const updateFilter = useCallback((patch: Partial<HubLearningFilters>) => {
    setSelected(null);
    setEvidence([]);
    setFilters((current) => cascadeHubLearningFilters(filterRows, { ...current, ...patch }));
  }, [filterRows]);

  useEffect(() => {
    setFilters(EMPTY_HUB_LEARNING_FILTERS);
    setSelected(null);
    setEvidence([]);
    setError(null);
  }, [hubCode]);

  useEffect(() => {
    let cancelled = false;
    async function loadFilters() {
      try {
        if (!live) {
          if (!cancelled) setFilterRows(DEMO_HUB_LEARNING_FILTERS);
          return;
        }
        const nextFilters = await callRpc("list_hub_learning_result_filters", { p_hub_code: hubCode });
        if (!cancelled) setFilterRows(nextFilters.map(mapHubLearningFilterRow));
      } catch (cause) {
        if (cancelled) return;
        setFilterRows([]);
        setError(cause instanceof Error ? cause.message : "Unable to load hub result filters.");
      }
    }
    void loadFilters();
    return () => {
      cancelled = true;
    };
  }, [callRpc, hubCode, live]);

  useEffect(() => {
    let cancelled = false;
    async function loadResults() {
      setLoading(true);
      setError(null);
      try {
        if (!live) {
          if (cancelled) return;
          const scoped = DEMO_HUB_LEARNING_RESULTS.filter((row) => (
            (!cascaded.courseKey || row.courseKey === cascaded.courseKey)
            && (!cascaded.groupCode || row.groupCode === cascaded.groupCode)
            && (!cascaded.studentNumber || row.studentNumber === cascaded.studentNumber)
            && (!cascaded.weekNumber || String(row.weekNumber ?? "") === cascaded.weekNumber)
            && (!cascaded.sessionNumber || String(row.sessionNumber ?? "") === cascaded.sessionNumber)
            && (!cascaded.activityKey || row.activityKey === cascaded.activityKey)
            && (!cascaded.completionStatus || row.completionStatus === cascaded.completionStatus)
          ));
          setResults(scoped);
          setSummary(scoped.length === DEMO_HUB_LEARNING_RESULTS.length
            ? DEMO_HUB_LEARNING_SUMMARY
            : {
              ...EMPTY_HUB_LEARNING_SUMMARY,
              learnerCount: new Set(scoped.map((row) => row.studentNumber)).size,
              activityCount: new Set(scoped.map((row) => row.activityKey)).size,
              rowCount: scoped.length,
              startedCount: scoped.filter((row) => row.completionStatus !== "not_started").length,
              completedCount: scoped.filter((row) => row.completionStatus === "completed").length,
              inProgressCount: scoped.filter((row) => row.completionStatus === "in_progress").length,
              notStartedCount: scoped.filter((row) => row.completionStatus === "not_started").length,
              scoredCompletedCount: scoped.filter((row) => row.scored).length,
              averageScorePercentage: scoped.some((row) => row.scored)
                ? Number((
                  scoped.filter((row) => row.scored).reduce((sum, row) => sum + (row.scorePercentage ?? 0), 0)
                  / scoped.filter((row) => row.scored).length
                ).toFixed(2))
                : null,
              completionPercentage: scoped.length === 0
                ? null
                : Number(((scoped.filter((row) => row.completionStatus === "completed").length / scoped.length) * 100).toFixed(2)),
            });
          return;
        }
        const params = hubLearningRpcParams(hubCode, cascaded);
        const [nextResults, nextSummary] = await Promise.all([
          callRpc("list_hub_learning_results", params),
          callRpc("summarise_hub_learning_results", params),
        ]);
        if (cancelled) return;
        setResults(nextResults.map(mapHubLearningResultRow));
        setSummary(mapHubLearningSummary(nextSummary[0]));
      } catch (cause) {
        if (cancelled) return;
        setResults([]);
        setSummary(EMPTY_HUB_LEARNING_SUMMARY);
        setError(cause instanceof Error ? cause.message : "Unable to load hub results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadResults();
    return () => {
      cancelled = true;
    };
  }, [callRpc, cascaded, hubCode, live]);

  async function openRow(row: HubLearningResultRow) {
    setSelected(row);
    setEvidenceError(null);
    setEvidenceLoading(true);
    try {
      if (!live) {
        setEvidence(DEMO_HUB_LEARNING_EVIDENCE);
        return;
      }
      const rows = await callRpc("list_hub_learning_result_evidence", {
        p_hub_code: hubCode,
        p_student_number: row.studentNumber,
        p_assignment_id: row.assignmentId,
      });
      setEvidence(rows.map(mapHubLearningEvidenceRow));
    } catch (cause) {
      setEvidence([]);
      setEvidenceError(cause instanceof Error ? cause.message : "Unable to load learner evidence.");
    } finally {
      setEvidenceLoading(false);
    }
  }

  return (
    <div data-testid="hub-learning-results">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Results → {label}</p>
            <h2>{label} results</h2>
            <p>
              Current class membership and current activity assignments for this hub.
              Practice checks and saved progress are shown as in progress, not as assignment scores.
            </p>
          </div>
        </div>
        <div className="toolbar" data-testid="hub-learning-filters">
          <FilterSelect
            id="hub-learning-course"
            label="Course"
            value={cascaded.courseKey}
            options={courses}
            onChange={(value) => updateFilter({ courseKey: value, groupCode: "", studentNumber: "" })}
          />
          <FilterSelect
            id="hub-learning-group"
            label="Group / class"
            value={cascaded.groupCode}
            options={groups}
            onChange={(value) => updateFilter({ groupCode: value, studentNumber: "" })}
          />
          <FilterSelect
            id="hub-learning-learner"
            label="Learner"
            value={cascaded.studentNumber}
            options={learners}
            onChange={(value) => updateFilter({ studentNumber: value })}
          />
          {weeks.length > 0 ? (
            <FilterSelect
              id="hub-learning-week"
              label="Week"
              value={cascaded.weekNumber}
              options={weeks}
              onChange={(value) => updateFilter({ weekNumber: value, sessionNumber: "" })}
            />
          ) : null}
          {sessions.length > 0 ? (
            <FilterSelect
              id="hub-learning-session"
              label="Session"
              value={cascaded.sessionNumber}
              options={sessions}
              onChange={(value) => updateFilter({ sessionNumber: value })}
            />
          ) : null}
          <FilterSelect
            id="hub-learning-activity"
            label="Activity"
            value={cascaded.activityKey}
            options={activities}
            onChange={(value) => updateFilter({ activityKey: value })}
          />
          <FilterSelect
            id="hub-learning-status"
            label="Status"
            value={cascaded.completionStatus}
            options={[
              { value: "not_started", label: "Not started" },
              { value: "in_progress", label: "In progress" },
              { value: "completed", label: "Completed" },
            ]}
            onChange={(value) => updateFilter({ completionStatus: value })}
          />
        </div>
      </section>

      {loading ? (
        <section className="panel">
          <p data-testid="hub-learning-loading">Loading hub results…</p>
        </section>
      ) : null}

      {error ? (
        <section className="panel">
          <div className="empty-state" data-testid="hub-learning-error">
            <span className="empty-state__mark" aria-hidden="true">!</span>
            <h3>Unable to load {label} results</h3>
            <p>{error}</p>
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="metrics-grid" aria-label={`${label} summary`}>
          <article className="metric-card metric-card--info">
            <div className="metric-card__label">Learners</div>
            <strong>{summary.learnerCount}</strong>
            <p>Current members in scope</p>
          </article>
          <article className="metric-card metric-card--positive">
            <div className="metric-card__label">Completed</div>
            <strong>{summary.completedCount}</strong>
            <p>Official completed attempts</p>
          </article>
          <article className="metric-card metric-card--warning">
            <div className="metric-card__label">In progress</div>
            <strong>{summary.inProgressCount}</strong>
            <p>Practice or saved progress</p>
          </article>
          <article className="metric-card">
            <div className="metric-card__label">Not started</div>
            <strong>{summary.notStartedCount}</strong>
            <p>Current assignments with no evidence</p>
          </article>
          <article className="metric-card metric-card--info">
            <div className="metric-card__label">Average score</div>
            <strong>{percentageLabel(summary.averageScorePercentage)}</strong>
            <p>Scored completed attempts only</p>
          </article>
          <article className="metric-card">
            <div className="metric-card__label">Completion</div>
            <strong>{percentageLabel(summary.completionPercentage)}</strong>
            <p>Official completions in this grid</p>
          </article>
        </section>
      ) : null}

      {!loading && !error && results.length === 0 ? (
        <section className="panel">
          <EmptyState
            title={`No ${label} results in this selection`}
            body="There is no current class work matching these filters. An empty list is not an application failure."
          />
        </section>
      ) : null}

      {!loading && !error && results.length > 0 ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Current work</p>
              <h2>Learner results</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Group</th>
                  <th>Activity</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Score</th>
                  <th>%</th>
                  <th>Correct / incorrect</th>
                  <th>Last activity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={`${row.studentNumber}:${row.assignmentId}`}>
                    <th scope="row">
                      {row.displayName}
                      <br />
                      <code>{row.studentNumber}</code>
                    </th>
                    <td>{row.groupName}</td>
                    <td>{row.activityTitle}</td>
                    <td>
                      <StatusBadge
                        label={completionLabel(row)}
                        tone={statusTone(completionLabel(row))}
                      />
                    </td>
                    <td>{sourceLabel(row.resultSource)}</td>
                    <td>{scoreLabel(row)}</td>
                    <td>{percentageLabel(row.scorePercentage)}</td>
                    <td>{countsLabel(row)}</td>
                    <td>{row.lastActivityAt ? formatDateTime(row.lastActivityAt) : "—"}</td>
                    <td>
                      <button
                        className="button button--small button--secondary"
                        type="button"
                        onClick={() => void openRow(row)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selected ? (
        <section className="panel" data-testid="hub-learning-evidence">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Learner evidence</p>
              <h2>{selected.displayName} · {selected.activityTitle}</h2>
              <p>
                {sourceLabel(selected.resultSource)}
                {selected.scored ? ` · ${scoreLabel(selected)}` : ""}
                {selected.completedAt ? ` · completed ${formatDateTime(selected.completedAt)}` : ""}
              </p>
            </div>
            <button className="button button--small button--secondary" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          {evidenceLoading ? <p>Loading responses…</p> : null}
          {evidenceError ? <p data-testid="hub-learning-evidence-error">{evidenceError}</p> : null}
          {!evidenceLoading && !evidenceError && evidence.length === 0 ? (
            <EmptyState
              title="No stored responses yet"
              body="This row has progress or membership, but there is no question-level learner evidence to show."
            />
          ) : null}
          {!evidenceLoading && evidence.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Source</th>
                    <th>Response</th>
                    <th>Result</th>
                    <th>Score</th>
                    <th>Feedback</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.map((item) => (
                      <tr key={`${item.source}:${item.questionKey}`}>
                        <th scope="row"><code>{item.questionKey}</code></th>
                        <td>{item.source === "formative" ? "Practice check" : "Official attempt"}</td>
                        <td>{formatEvidenceValue(item.responsePayload)}</td>
                        <td>
                          {item.isCorrect == null ? "—" : item.isCorrect ? "Correct" : "Incorrect"}
                        </td>
                        <td>
                          {item.awardedScore == null || item.maxScore == null
                            ? "—"
                            : `${item.awardedScore} / ${item.maxScore}`}
                        </td>
                        <td>{item.feedbackSummary ?? "—"}</td>
                        <td>{item.recordedAt ? formatDateTime(item.recordedAt) : "—"}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
