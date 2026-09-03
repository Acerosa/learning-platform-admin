"use client";

import { useMemo, useState } from "react";
import type {
  DiagnosticResponseRecord,
  DiagnosticSessionRecord,
  DiagnosticSummaryRecord,
} from "../api/admin-api.ts";
import {
  QUESTION_LABEL_GAP,
  READINESS_DIAGNOSTIC_NAME,
  correctnessLabel,
  diagnosticOverview,
  filterDiagnosticSessions,
  formatCompletionRate,
  formatDiagnosticStatus,
  formatEvidence,
  groupResponsesByUnit,
  hasAuthoritativeCorrectness,
  questionDistributions,
  recentDiagnosticSessions,
  responsesForSession,
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
  initialSessionId = null,
}: {
  sessions: readonly DiagnosticSessionRecord[];
  responses: readonly DiagnosticResponseRecord[];
  summaries: readonly DiagnosticSummaryRecord[];
  error?: string | null;
  initialSessionId?: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<DiagnosticStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId);

  const overview = useMemo(() => diagnosticOverview(summaries, sessions), [sessions, summaries]);
  const filteredSessions = useMemo(
    () => filterDiagnosticSessions(sessions, { status: statusFilter, query }),
    [query, sessions, statusFilter],
  );
  const recent = useMemo(() => recentDiagnosticSessions(sessions), [sessions]);
  const selected = sessions.find((row) => row.sessionId === selectedSessionId) ?? null;
  const selectedResponses = selected ? responsesForSession(responses, selected.sessionId) : [];
  const grouped = groupResponsesByUnit(selectedResponses);
  const showCorrectness = hasAuthoritativeCorrectness(selectedResponses);
  const distributions = useMemo(() => questionDistributions(responses), [responses]);

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

  return (
    <div data-testid="readiness-diagnostic">
      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Readiness Diagnostic</p>
            <h2>{overview?.diagnosticName ?? READINESS_DIAGNOSTIC_NAME}</h2>
            <p>
              Readiness / diagnostic indicators, not assessment results. Student name and
              student ID are learner-entered identifiers.
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
              detail="Submitted diagnostic answers"
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
            <p>Learner-entered identifiers. These names and IDs are not authenticated.</p>
          </div>
          <span className="toolbar__count" role="status">{filteredSessions.length} sessions</span>
        </div>
        <div className="toolbar">
          <div className="toolbar__search">
            <label htmlFor="diagnostic-status">Status</label>
            <select
              id="diagnostic-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DiagnosticStatusFilter)}
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
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
                  <th scope="col">Student name</th>
                  <th scope="col">Student ID</th>
                  <th scope="col">Started</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Status</th>
                  <th scope="col">Responses</th>
                  <th scope="col">Not sure</th>
                  <th scope="col"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <tr key={session.sessionId} data-session-id={session.sessionId}>
                    <th scope="row">
                      <span className="table-primary">{session.studentName}</span>
                      <small>{session.hubName}</small>
                    </th>
                    <td><code>{session.studentId}</code></td>
                    <td>{formatDateTime(session.startedAt)}</td>
                    <td>{formatDateTime(session.completedAt)}</td>
                    <td>
                      <StatusBadge
                        label={formatDiagnosticStatus(session.status)}
                        tone={statusTone(session.status)}
                      />
                    </td>
                    <td>{session.responseCount}</td>
                    <td>{session.notSureCount}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={sessions.length ? "No matching sessions" : "No diagnostic sessions yet"}
            body={sessions.length
              ? "Change the status or name filter to see other sittings."
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
                {formatDiagnosticStatus(selected.status)}
              </p>
              <p>
                Started {formatDateTime(selected.startedAt)}. Completed {formatDateTime(selected.completedAt)}.
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
                        <td>{response.isNotSure ? "Not sure" : "—"}</td>
                        <td>{response.confidence ?? "—"}</td>
                        {showCorrectness ? (
                          <td>{correctnessLabel(response.isCorrect) ?? "Not marked"}</td>
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
                        : "—"}
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
