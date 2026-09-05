"use client";

import { useMemo, useState } from "react";
import type {
  DiagnosticResponseRecord,
  DiagnosticSessionRecord,
  DiagnosticSummaryRecord,
} from "../api/admin-api.ts";
import {
  EXPECTED_READINESS_QUESTION_COUNT,
  QUESTION_LABEL_GAP,
  READINESS_DIAGNOSTIC_NAME,
  UNAVAILABLE_RESULT,
  diagnosticOverview,
  diagnosticPercentageLabel,
  diagnosticSessionScoreLabel,
  diagnosticUnitScores,
  diagnosticVersionLabel,
  diagnosticVersions,
  filterDiagnosticSessions,
  formatCompletionRate,
  formatDiagnosticStatus,
  formatEvidence,
  groupResponsesByUnit,
  hasAuthoritativeCorrectness,
  lastActivityAt,
  questionCatalogue,
  questionDistributions,
  recentDiagnosticSessions,
  responseAwardedLabel,
  responseMarkLabel,
  responsesForSession,
  sortDiagnosticSessionsByRecent,
  unansweredQuestions,
  type DiagnosticDateFilter,
  type DiagnosticStatusFilter,
} from "../analytics/diagnostic.ts";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import { formatDateTime } from "../utils/format";

function statusTone(status: string): BadgeTone {
  if (status === "completed") return "info";
  if (status === "started") return "warning";
  return "neutral";
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card metric-card--info">
      <div className="metric-card__label">
        <span aria-hidden="true" />
        {label}
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function ReadinessDiagnosticPage({
  sessions,
  responses,
  summaries,
  error = null,
  loading = false,
  initialSessionId = null,
  expectedQuestionCount = EXPECTED_READINESS_QUESTION_COUNT,
  variant = "analytics",
}: {
  sessions: readonly DiagnosticSessionRecord[];
  responses: readonly DiagnosticResponseRecord[];
  summaries: readonly DiagnosticSummaryRecord[];
  error?: string | null;
  loading?: boolean;
  initialSessionId?: string | null;
  expectedQuestionCount?: number;
  variant?: "analytics" | "results";
}) {
  const [statusFilter, setStatusFilter] = useState<DiagnosticStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DiagnosticDateFilter>("last-7-days");
  const [versionFilter, setVersionFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId);

  const overview = useMemo(() => diagnosticOverview(summaries, sessions), [sessions, summaries]);
  const versions = useMemo(() => diagnosticVersions(sessions), [sessions]);
  const filteredSessions = useMemo(
    () => sortDiagnosticSessionsByRecent(filterDiagnosticSessions(sessions, {
      status: statusFilter,
      query,
      version: versionFilter,
      date: dateFilter,
    })),
    [dateFilter, query, sessions, statusFilter, versionFilter],
  );
  const recent = useMemo(() => recentDiagnosticSessions(sessions), [sessions]);
  const selected = sessions.find((row) => row.sessionId === selectedSessionId) ?? null;
  const selectedResponses = selected ? responsesForSession(responses, selected.sessionId) : [];
  const grouped = groupResponsesByUnit(selectedResponses);
  const unitScores = diagnosticUnitScores(selectedResponses);
  const showCorrectness = hasAuthoritativeCorrectness(selectedResponses)
    || selectedResponses.some((row) => row.awardedScore != null);
  const distributions = useMemo(() => questionDistributions(responses), [responses]);
  const catalogue = useMemo(() => questionCatalogue(responses), [responses]);
  const missing = selected ? unansweredQuestions(selectedResponses, catalogue) : [];
  const score = selected ? diagnosticSessionScoreLabel(selected) : UNAVAILABLE_RESULT;
  const percentage = selected
    ? diagnosticPercentageLabel(selectedResponses, expectedQuestionCount, selected)
    : UNAVAILABLE_RESULT;
  const eyebrow = variant === "results" ? "Results → Induction / Readiness" : "Readiness Diagnostic";

  if (error) {
    return (
      <section className="panel" aria-label="Readiness Diagnostic error">
        <EmptyState
          title="Readiness Diagnostic could not be loaded"
          body={error}
        />
      </section>
    );
  }

  if (loading) {
    return (
      <section className="panel" aria-label="Readiness Diagnostic loading">
        <EmptyState title="Loading diagnostic sittings" body="Fetching staff-only diagnostic sessions." />
      </section>
    );
  }

  return (
    <div data-testid="readiness-diagnostic">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{overview?.diagnosticName ?? READINESS_DIAGNOSTIC_NAME}</h2>
            <p>
              Readiness / diagnostic indicators, not assessment results. Student name and
              student ID are learner-entered identifiers. Score and percentage stay {UNAVAILABLE_RESULT} until
              the server stores an authoritative mark.
            </p>
          </div>
        </div>
        {overview ? (
          <section className="metrics-grid" aria-label="Readiness diagnostic summary">
            <MetricCard label="Hub" value={overview.hubName} detail={overview.hubCode} />
            <MetricCard label="Course" value={overview.courseKey} detail={overview.courseTitle} />
            <MetricCard
              label="Sessions started"
              value={String(overview.startedCount)}
              detail="Diagnostic sittings begun"
            />
            <MetricCard
              label="Completed"
              value={String(overview.completedCount)}
              detail={`${formatCompletionRate(overview.completionPercentage)} completion`}
            />
            <MetricCard
              label="Responses"
              value={String(overview.responseCount)}
              detail={`Current diagnostic has ${expectedQuestionCount} questions`}
            />
            <MetricCard
              label="Not sure"
              value={String(overview.notSureCount)}
              detail={`${formatCompletionRate(overview.notSurePercentage)} of responses`}
            />
          </section>
        ) : (
          <EmptyState
            title="No diagnostic summary yet"
            body="Summary counts will appear when learners start the readiness diagnostic."
          />
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Recent sessions</p>
            <h2>Latest diagnostic sittings</h2>
          </div>
        </div>
        {recent.length ? (
          <ul className="health-list">
            {recent.map((session) => (
              <li key={session.sessionId}>
                <span>
                  <strong>{session.studentName}</strong>
                  <small>{session.studentId} · {formatDiagnosticStatus(session.status)}</small>
                </span>
                <StatusBadge label={formatDiagnosticStatus(session.status)} tone={statusTone(session.status)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No sessions yet" body="Recent diagnostic sittings will appear here." />
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Sessions</p>
            <h2>Diagnostic sessions</h2>
            <p>Learner-entered identifiers. These names and IDs are not authenticated. Recent sittings are listed first.</p>
          </div>
          <span className="toolbar__count" role="status">{filteredSessions.length} sessions</span>
        </div>
        <div className="toolbar">
          <div className="toolbar__search">
            <label htmlFor="diagnostic-date">Date</label>
            <select
              id="diagnostic-date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as DiagnosticDateFilter)}
            >
              <option value="last-7-days">Last 7 days</option>
              <option value="last-24-hours">Last 24 hours</option>
              <option value="all">All dates</option>
            </select>
          </div>
          <div className="toolbar__search">
            <label htmlFor="diagnostic-status">Status</label>
            <select
              id="diagnostic-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DiagnosticStatusFilter)}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">In progress</option>
            </select>
          </div>
          <div className="toolbar__search">
            <label htmlFor="diagnostic-version">Diagnostic version</label>
            <select
              id="diagnostic-version"
              value={versionFilter}
              onChange={(event) => setVersionFilter(event.target.value)}
            >
              <option value="">All versions</option>
              {versions.map((version) => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>
          </div>
          <div className="toolbar__search">
            <label htmlFor="diagnostic-query">Student name or ID</label>
            <input
              id="diagnostic-query"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or ID"
            />
          </div>
        </div>
        {filteredSessions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Student ID</th>
                  <th scope="col">Student name</th>
                  <th scope="col">Group</th>
                  <th scope="col">Version</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Answered</th>
                  <th scope="col">Total questions</th>
                  <th scope="col">Score</th>
                  <th scope="col">Last activity</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => {
                  return (
                    <tr key={session.sessionId} data-session-id={session.sessionId}>
                      <th scope="row"><code>{session.studentId}</code></th>
                      <td>
                        <span className="table-primary">{session.studentName}</span>
                        <small>{session.hubName}</small>
                      </td>
                      <td>{UNAVAILABLE_RESULT}</td>
                      <td>{diagnosticVersionLabel(session)}</td>
                      <td>
                        <StatusBadge
                          label={formatDiagnosticStatus(session.status)}
                          tone={statusTone(session.status)}
                        />
                      </td>
                      <td>{formatDateTime(session.startedAt)}</td>
                      <td>{formatDateTime(session.completedAt)}</td>
                      <td>{session.responseCount}</td>
                      <td>{expectedQuestionCount}</td>
                      <td>{diagnosticSessionScoreLabel(session)}</td>
                      <td>{formatDateTime(lastActivityAt(session))}</td>
                      <td>
                        <button
                          type="button"
                          className="button button--small button--secondary"
                          onClick={() => setSelectedSessionId(session.sessionId)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={sessions.length ? "No matching sessions" : "No diagnostic sessions yet"}
            body={sessions.length
              ? "Change the date, status or name filter to see other sittings."
              : "Sessions appear after a learner starts the readiness diagnostic."}
          />
        )}
      </section>

      {selected ? (
        <section className="panel" aria-label="Diagnostic session detail">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Session detail</p>
              <h2>{selected.studentName}</h2>
              <p>
              Student ID <code>{selected.studentId}</code> · learner-entered identifier ·{" "}
              {formatDiagnosticStatus(selected.status)} · version {diagnosticVersionLabel(selected)}
            </p>
            <p>
              Started {formatDateTime(selected.startedAt)}. Completed {formatDateTime(selected.completedAt)}.
              Last activity {formatDateTime(lastActivityAt(selected))}.
            </p>
            <p>
              Result {score}. Percentage {percentage}. Group {UNAVAILABLE_RESULT}.
              Answered {selected.responseCount} of {expectedQuestionCount}.
              Maximum marks {selected.maxScore ?? UNAVAILABLE_RESULT}.
            </p>
            </div>
            <button
              type="button"
              className="button button--small button--secondary"
              onClick={() => setSelectedSessionId(null)}
            >
              Close
            </button>
          </div>
          {missing.length ? (
            <p>
              Unanswered questions: {missing.map((item) => item.questionKey).join(", ")}.
              Identifiers only — question text is not in the Admin diagnostic views.
            </p>
          ) : (
            <p>Unanswered questions: none against the responses stored for this diagnostic.</p>
          )}
          {unitScores.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Area</th>
                    <th scope="col">Score</th>
                    <th scope="col">Maximum</th>
                    <th scope="col">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {unitScores.map((row) => (
                    <tr key={row.unitKey}>
                      <th scope="row">{row.unitLabel}</th>
                      <td>{row.awardedScore}</td>
                      <td>{row.maxScore}</td>
                      <td>{row.percentage == null ? UNAVAILABLE_RESULT : `${row.percentage}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {grouped.length ? grouped.map((group) => (
            <section key={group.unitKey} aria-label={group.unitLabel}>
              <h3>{group.unitLabel}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col">Evidence</th>
                      <th scope="col">Not sure</th>
                      <th scope="col">Confidence</th>
                      {showCorrectness ? <th scope="col">Marked</th> : null}
                      {showCorrectness ? <th scope="col">Awarded</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {group.responses.map((response) => (
                      <tr key={response.responseId}>
                        <th scope="row">
                          <span className="table-primary">{response.questionKey}</span>
                          <small><code>{response.activityId}</code></small>
                        </th>
                        <td>{formatEvidence(response.evidence)}</td>
                        <td>{response.isNotSure ? "Not sure" : UNAVAILABLE_RESULT}</td>
                        <td>{response.confidence ?? UNAVAILABLE_RESULT}</td>
                        {showCorrectness ? (
                          <td>{responseMarkLabel(response)}</td>
                        ) : null}
                        {showCorrectness ? (
                          <td>{responseAwardedLabel(response)}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )) : (
            <EmptyState title="No responses yet" body="This sitting has not submitted diagnostic responses." />
          )}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Response patterns</p>
            <h2>Question-level distributions</h2>
            <p>{QUESTION_LABEL_GAP}</p>
          </div>
        </div>
        {distributions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col">Question</th>
                  <th scope="col">Responses</th>
                  <th scope="col">Not sure</th>
                  <th scope="col">Options chosen</th>
                  <th scope="col">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((row) => (
                  <tr key={`${row.activityId}:${row.questionKey}`}>
                    <th scope="row">{row.unitLabel}</th>
                    <td>
                      <span className="table-primary">{row.questionKey}</span>
                      <small><code>{row.activityId}</code></small>
                    </td>
                    <td>{row.responseCount}</td>
                    <td>{row.notSureCount}</td>
                    <td>
                      {row.optionCounts.length
                        ? row.optionCounts.map((option) => `${option.id} (${option.count})`).join(", ")
                        : "Structured evidence"}
                    </td>
                    <td>
                      {row.confidenceCounts.length
                        ? row.confidenceCounts.map((item) => `${item.value} (${item.count})`).join(", ")
                        : UNAVAILABLE_RESULT}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No response patterns yet"
            body="Option, Not-sure and confidence counts appear after responses are submitted."
          />
        )}
      </section>
    </div>
  );
}
