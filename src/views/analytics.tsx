"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ActivityAnalyticsRecord,
  AdminDataSnapshot,
  LearnerActivityPerformanceRecord,
  QuestionGroupPerformanceRecord,
  QuestionPerformanceRecord,
} from "../api/admin-api.ts";
import {
  ALL_SCOPE,
  EMPTY_SCOPE,
  PANE_FILTERS,
  activityOptions,
  activityRowKey,
  attentionSignalInScope,
  constrainScope,
  courseOptions,
  groupOptions,
  hubOptions,
  learnerActivityStatus,
  learnerSummaries,
  questionsAreGroupScoped,
  scopeFromSearch,
  scopeTrail,
  scopedActivities,
  scopedGroupQuestions,
  scopedGroups,
  scopedLearnerActivity,
  scopedOverview,
  scopedPlatformQuestions,
  searchFromAnalyticsState,
  skillOptions,
  topicOptions,
  type AnalyticsPane,
  type AnalyticsScope,
  type FilterOption,
  type LearnerSummaryRow,
} from "../analytics/scope.ts";
import { METRIC_DEFINITIONS, displayLabel, percentageLabel, secondaryKey } from "../analytics/metrics.ts";
import { StatusBadge } from "../components/status-badge";
import { getAdminModule } from "../router/modules";
import {
  assessmentReadinessFromSnapshot,
  interventionSignalsFromSnapshot,
} from "../results/from-admin-snapshot";
import { formatDate } from "../utils/format";

function canUseSearchParams() {
  return typeof document !== "undefined"
    && document.querySelector('meta[name="learning-platform-admin-router"][content="hash"]') == null;
}

function MetricCard({
  label,
  value,
  detail,
  definition,
}: {
  label: string;
  value: string;
  detail: string;
  definition?: string;
}) {
  return (
    <article className="metric-card metric-card--info">
      <div className="metric-card__label">
        <span aria-hidden="true" />
        {label}
      </div>
      <strong>{value}</strong>
      <p title={definition}>{detail}</p>
    </article>
  );
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
  options: readonly FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={ALL_SCOPE}>All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
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

function DefinitionList() {
  return (
    <section className="panel analytics-definitions" aria-label="Metric definitions">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Metric definitions</p>
          <h2>How these figures are calculated</h2>
        </div>
      </div>
      <dl className="analytics-definitions__list">
        {Object.values(METRIC_DEFINITIONS).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ScoreCell({ value }: { value: number | null | undefined }) {
  return <td>{percentageLabel(value)}</td>;
}

function isGroupQuestion(
  row: QuestionPerformanceRecord | QuestionGroupPerformanceRecord,
): row is QuestionGroupPerformanceRecord {
  return "assignmentId" in row;
}

function LearnerDetail({
  learner,
  onClose,
}: {
  learner: LearnerSummaryRow;
  onClose: () => void;
}) {
  const latestCompleted = learner.rows
    .filter((row) => row.completedAttemptCount > 0)
    .sort((left, right) => (right.latestCompletedAt ?? "").localeCompare(left.latestCompletedAt ?? ""))[0];
  const best = learner.rows
    .map((row) => row.bestScorePercentage)
    .filter((value): value is number => value != null);
  const bestResult = best.length ? Math.max(...best) : null;

  return (
    <section className="panel analytics-detail" aria-label={`${learner.displayName} activity performance`}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Learner</p>
          <h2>{learner.displayName}</h2>
          <p>
            Student No: {learner.studentNumber}
            {" · "}
            Group: {learner.groupName}
            {" · "}
            Course: {learner.courseTitle}
          </p>
        </div>
        <button type="button" className="button button--small button--secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="analytics-metric-split" aria-label="Learner summary">
        <section>
          <h3>Performance</h3>
          <ul>
            <li><span>Latest Result</span><strong>{percentageLabel(learner.latestResultPercentage)}</strong></li>
            <li><span>Attempt Average</span><strong>{percentageLabel(learner.attemptAveragePercentage)}</strong></li>
            <li><span>Best Result</span><strong>{percentageLabel(bestResult)}</strong></li>
          </ul>
        </section>
        <section>
          <h3>Engagement</h3>
          <ul>
            <li><span>Completed</span><strong>{learner.completedCount}</strong></li>
            <li><span>Assigned</span><strong>{learner.assignedCount}</strong></li>
            <li><span>Awaiting Review</span><strong>{learner.requiresReviewCount}</strong></li>
            <li><span>Last Activity</span><strong>{latestCompleted?.latestCompletedAt ? formatDate(latestCompleted.latestCompletedAt) : "Not started"}</strong></li>
          </ul>
        </section>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Activity</th>
              <th scope="col">Course</th>
              <th scope="col">Group</th>
              <th scope="col">Attempts</th>
              <th scope="col">First Result</th>
              <th scope="col">Latest Result</th>
              <th scope="col">Best Result</th>
              <th scope="col">Status</th>
              <th scope="col">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {learner.rows.map((row) => (
              <tr key={row.assignmentId}>
                <th scope="row">
                  <span className="table-primary">{displayLabel(row.activityTitle, row.activityKey)}</span>
                  {secondaryKey(row.activityTitle, row.activityKey) ? <small><code>{row.activityKey}</code></small> : null}
                </th>
                <td>{row.courseTitle}</td>
                <td>{row.groupName}</td>
                <td>{row.attemptCount}</td>
                <ScoreCell value={row.firstScorePercentage} />
                <ScoreCell value={row.latestScorePercentage} />
                <ScoreCell value={row.bestScorePercentage} />
                <td>{learnerActivityStatus(row)}</td>
                <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "Not started"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActivityDetail({
  activity,
  learners,
  questions,
  questionScopeLabel,
  onClose,
}: {
  activity: ActivityAnalyticsRecord;
  learners: readonly LearnerActivityPerformanceRecord[];
  questions: readonly { questionKey: string; questionTitle?: string; correctCount: number; incorrectCount: number; unansweredCount?: number; correctnessPercentage: number | null; requiresReviewCount: number }[];
  questionScopeLabel: string;
  onClose: () => void;
}) {
  return (
    <section className="panel analytics-detail" aria-label={`${displayLabel(activity.activityTitle, activity.activityKey)} summary`}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Activity</p>
          <h2>{displayLabel(activity.activityTitle, activity.activityKey)}</h2>
          <p>
            {displayLabel(activity.courseTitle, activity.courseKey)}
            {" · "}
            {displayLabel(activity.groupName, activity.groupCode)}
            {" · "}
            Version {activity.activityVersion}
          </p>
        </div>
        <button type="button" className="button button--small button--secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <section className="metrics-grid metrics-grid--compact" aria-label="Activity summary">
        <MetricCard label="Learners" value={String(activity.assignedLearnerCount)} detail="Assigned" definition={METRIC_DEFINITIONS.completion.definition} />
        <MetricCard label="Participating" value={`${activity.attemptedLearnerCount} / ${percentageLabel(activity.participationPercentage)}`} detail="At least one attempt" definition={METRIC_DEFINITIONS.participation.definition} />
        <MetricCard label="Completed" value={`${activity.completedLearnerCount} / ${percentageLabel(activity.completionPercentage)}`} detail="Completed attempt" definition={METRIC_DEFINITIONS.completion.definition} />
        <MetricCard label="Latest-result average" value={percentageLabel(activity.latestScorePercentage)} detail={METRIC_DEFINITIONS.latestResult.label} definition={METRIC_DEFINITIONS.latestResult.definition} />
        <MetricCard label="Best-result average" value={percentageLabel(activity.bestScorePercentage)} detail={METRIC_DEFINITIONS.bestResult.label} definition={METRIC_DEFINITIONS.bestResult.definition} />
        <MetricCard label="Attempts" value={String(activity.attemptCount)} detail={METRIC_DEFINITIONS.attempts.definition} definition={METRIC_DEFINITIONS.attempts.definition} />
        <MetricCard label="Awaiting review" value={String(activity.requiresReviewCount)} detail={METRIC_DEFINITIONS.awaitingReview.definition} definition={METRIC_DEFINITIONS.awaitingReview.definition} />
      </section>
      <div className="table-wrap">
        <table>
          <caption className="analytics-caption">Learner results</caption>
          <thead>
            <tr>
              <th scope="col">Learner</th>
              <th scope="col">Attempts</th>
              <th scope="col">First Result</th>
              <th scope="col">Latest Result</th>
              <th scope="col">Best Result</th>
              <th scope="col">Review</th>
              <th scope="col">Last Attempt</th>
            </tr>
          </thead>
          <tbody>
            {learners.length ? learners.map((row) => (
              <tr key={row.learnerId}>
                <th scope="row">{row.displayName}</th>
                <td>{row.attemptCount}</td>
                <ScoreCell value={row.firstScorePercentage} />
                <ScoreCell value={row.latestScorePercentage} />
                <ScoreCell value={row.bestScorePercentage} />
                <td>{row.requiresReviewCount || "—"}</td>
                <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "Not started"}</td>
              </tr>
            )) : (
              <tr><td colSpan={7}>No assigned learners in this activity scope.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table>
          <caption className="analytics-caption">Questions · {questionScopeLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Correct</th>
              <th scope="col">Incorrect</th>
              <th scope="col">Not Answered</th>
              <th scope="col">Correct %</th>
              <th scope="col">Review Required</th>
            </tr>
          </thead>
          <tbody>
            {questions.length ? questions.map((row) => (
              <tr key={row.questionKey}>
                <th scope="row">
                  <span className="table-primary">{displayLabel(row.questionTitle, row.questionKey)}</span>
                  {secondaryKey(row.questionTitle, row.questionKey) ? <small><code>{row.questionKey}</code></small> : null}
                </th>
                <td>{row.correctCount}</td>
                <td>{row.incorrectCount}</td>
                <td>{row.unansweredCount == null ? "—" : row.unansweredCount}</td>
                <td>{percentageLabel(row.correctnessPercentage)}</td>
                <td>{row.requiresReviewCount}</td>
              </tr>
            )) : (
              <tr><td colSpan={6}>No question aggregates for this activity. Answer keys are never shown here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AnalyticsPage({ data }: { data: AdminDataSnapshot }) {
  const currentModule = getAdminModule("analytics");
  const initialSearch = canUseSearchParams() && typeof window !== "undefined" ? window.location.search : "";
  const initial = scopeFromSearch(initialSearch);
  const [pane, setPane] = useState<AnalyticsPane>(initial.pane ?? "overview");
  const [scope, setScope] = useState<AnalyticsScope>(() => constrainScope({
    ...EMPTY_SCOPE,
    ...Object.fromEntries(
      Object.entries({
        hubCode: initial.hubCode,
        courseKey: initial.courseKey,
        groupCode: initial.groupCode,
        activityKey: initial.activityKey,
        topicKey: initial.topicKey,
        skillKey: initial.skillKey,
      }).filter(([, value]) => value),
    ),
  }, data));
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(initial.learnerId ?? null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(initial.assignmentId ?? null);

  const constrained = useMemo(() => constrainScope(scope, data), [data, scope]);
  const activeFilters = PANE_FILTERS[pane];
  const overview = useMemo(() => scopedOverview(data, constrained), [constrained, data]);
  const readiness = assessmentReadinessFromSnapshot(data);
  const signals = interventionSignalsFromSnapshot(data);
  const groups = useMemo(() => scopedGroups(data, constrained), [constrained, data]);
  const learners = useMemo(() => learnerSummaries(data, constrained), [constrained, data]);
  const activities = useMemo(() => scopedActivities(data, constrained), [constrained, data]);
  const platformQuestions = useMemo(() => scopedPlatformQuestions(data, constrained), [constrained, data]);
  const groupQuestions = useMemo(() => scopedGroupQuestions(data, constrained), [constrained, data]);
  const topics = data.topicPerformance.filter(
    (row) => constrained.topicKey === ALL_SCOPE || row.topicKey === constrained.topicKey,
  );
  const skills = data.skillPerformance.filter(
    (row) => constrained.skillKey === ALL_SCOPE || row.skillKey === constrained.skillKey,
  );

  const selectedLearner = learners.find((row) => row.learnerId === selectedLearnerId) ?? null;
  const selectedActivity = activities.find((row) => activityRowKey(row) === selectedAssignmentId)
    ?? activities.find((row) => row.assignmentId === selectedAssignmentId)
    ?? null;
  const selectedActivityLearners = selectedActivity
    ? scopedLearnerActivity(data, constrained).filter((row) =>
      row.assignmentId === selectedActivity.assignmentId
      || (row.activityKey === selectedActivity.activityKey && row.groupCode === selectedActivity.groupCode && row.activityVersion === selectedActivity.activityVersion),
    )
    : [];
  const selectedActivityQuestions = selectedActivity
    ? (selectedActivity.assignmentId
      ? data.questionGroupPerformance.filter((row) => row.assignmentId === selectedActivity.assignmentId)
      : groupQuestions.filter((row) => row.activityKey === selectedActivity.activityKey && row.groupCode === selectedActivity.groupCode))
    : [];

  useEffect(() => {
    if (!canUseSearchParams()) return;
    const next = searchFromAnalyticsState({
      scope: constrained,
      pane,
      learnerId: selectedLearnerId,
      assignmentId: selectedAssignmentId,
    });
    if (window.location.search !== next) {
      window.history.replaceState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
    }
  }, [constrained, pane, selectedAssignmentId, selectedLearnerId]);

  function updateScope(patch: Partial<AnalyticsScope>) {
    setScope((current) => constrainScope({ ...current, ...patch }, data));
    setSelectedLearnerId(null);
    setSelectedAssignmentId(null);
  }

  const trail = scopeTrail(data, constrained);
  const panes: Array<{ id: AnalyticsPane; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "groups", label: "Groups" },
    { id: "learners", label: "Learners" },
    { id: "activities", label: "Activities" },
    { id: "questions", label: "Questions" },
    { id: "topics-skills", label: "Topics & skills" },
    { id: "readiness", label: "Readiness" },
    { id: "attention", label: "Needs attention" },
  ];
  const questionRows = questionsAreGroupScoped(constrained) ? groupQuestions : platformQuestions;
  const questionGrainLabel = questionsAreGroupScoped(constrained)
    ? "Scoped to the selected hub, course or group"
    : "Platform-wide across teaching groups";

  const scopedSignals = signals.filter((signal) => attentionSignalInScope(signal, constrained, {
    learnerNumbers: learners.map((row) => row.studentNumber),
    groupCodes: groups.map((row) => row.groupCode),
    activities: activities.map((row) => ({ groupCode: row.groupCode, activityKey: row.activityKey })),
  }));

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{currentModule.eyebrow}</p>
          <h1>{currentModule.label}</h1>
          <p>
            Staff assessment analytics from authoritative attempts, responses and curriculum
            metadata. Detailed evidence remains in Results.
          </p>
        </div>
      </header>

      <section className="panel analytics-scope" aria-label="Active analytics scope">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Scope</p>
            <h2>
              {trail.map((part, index) => (
                <span key={`${part}:${index}`}>
                  {index ? <span aria-hidden="true"> › </span> : null}
                  {part}
                </span>
              ))}
            </h2>
            <p>
              {pane === "topics-skills"
                ? "Topic and skill tables use existing metadata keys only and are not filtered by hub, course or group."
                : pane === "readiness"
                  ? "Completion, latest-result average and review counts follow this scope. Topic coverage and learner-summary trend remain platform-wide."
                  : "Every metric below relates to this selected scope."}
            </p>
          </div>
          <button
            type="button"
            className="button button--small button--secondary"
            onClick={() => {
              setScope(EMPTY_SCOPE);
              setSelectedLearnerId(null);
              setSelectedAssignmentId(null);
            }}
          >
            Reset filters
          </button>
        </div>
      </section>

      <div className="toolbar" role="tablist" aria-label="Analytics views">
        {panes.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={pane === item.id}
            className={`button button--small ${pane === item.id ? "button--primary" : "button--secondary"}`}
            onClick={() => {
              setPane(item.id);
              setSelectedLearnerId(null);
              setSelectedAssignmentId(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="panel" aria-label="Analytics filters">
        <div className="toolbar">
          {activeFilters.has("hubCode") ? (
            <FilterSelect id="analytics-hub" label="Hub" value={constrained.hubCode} options={hubOptions(data)} onChange={(hubCode) => updateScope({ hubCode, courseKey: ALL_SCOPE, groupCode: ALL_SCOPE, activityKey: ALL_SCOPE })} />
          ) : null}
          {activeFilters.has("courseKey") ? (
            <FilterSelect id="analytics-course" label="Course" value={constrained.courseKey} options={courseOptions(data, constrained)} onChange={(courseKey) => updateScope({ courseKey, groupCode: ALL_SCOPE, activityKey: ALL_SCOPE })} />
          ) : null}
          {activeFilters.has("groupCode") ? (
            <FilterSelect id="analytics-group" label="Group" value={constrained.groupCode} options={groupOptions(data, constrained)} onChange={(groupCode) => updateScope({ groupCode, activityKey: ALL_SCOPE })} />
          ) : null}
          {activeFilters.has("activityKey") ? (
            <FilterSelect id="analytics-activity" label="Activity" value={constrained.activityKey} options={activityOptions(data, constrained)} onChange={(activityKey) => updateScope({ activityKey })} />
          ) : null}
          {activeFilters.has("topicKey") ? (
            <FilterSelect id="analytics-topic" label="Topic" value={constrained.topicKey} options={topicOptions(data)} onChange={(topicKey) => updateScope({ topicKey })} />
          ) : null}
          {activeFilters.has("skillKey") ? (
            <FilterSelect id="analytics-skill" label="Skill" value={constrained.skillKey} options={skillOptions(data)} onChange={(skillKey) => updateScope({ skillKey })} />
          ) : null}
        </div>
        {pane === "topics-skills" ? (
          <p className="analytics-filter-note">Topic and skill analytics use existing metadata links only and are not grouped by course or teaching group.</p>
        ) : null}
        {pane === "questions" ? (
          <p className="analytics-filter-note">{questionGrainLabel}. Partially correct is not shown because marking evidence does not distinguish it.</p>
        ) : null}
      </section>

      {pane === "overview" ? (
        <>
          <section className="metrics-grid" aria-label="Assessment overview">
            <MetricCard label="Learners" value={String(overview.assignedLearners)} detail="Assigned in this scope" />
            <MetricCard label="Participating" value={`${overview.participatingLearners} / ${percentageLabel(overview.participationPercentage)}`} detail={METRIC_DEFINITIONS.participation.definition} definition={METRIC_DEFINITIONS.participation.definition} />
            <MetricCard label="Completed" value={`${overview.completedLearners} / ${percentageLabel(overview.completionPercentage)}`} detail={METRIC_DEFINITIONS.completion.definition} definition={METRIC_DEFINITIONS.completion.definition} />
            <MetricCard label="Latest-result average" value={percentageLabel(overview.latestResultAverage)} detail={METRIC_DEFINITIONS.latestResult.definition} definition={METRIC_DEFINITIONS.latestResult.definition} />
            <MetricCard label="Best-result average" value={percentageLabel(overview.bestResultAverage)} detail={METRIC_DEFINITIONS.bestResult.definition} definition={METRIC_DEFINITIONS.bestResult.definition} />
            <MetricCard label="Attempts" value={String(overview.attemptCount)} detail={METRIC_DEFINITIONS.attempts.definition} definition={METRIC_DEFINITIONS.attempts.definition} />
            <MetricCard label="Awaiting review" value={String(overview.awaitingReview)} detail={METRIC_DEFINITIONS.awaitingReview.definition} definition={METRIC_DEFINITIONS.awaitingReview.definition} />
          </section>
          <DefinitionList />
        </>
      ) : null}

      {pane === "groups" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Group analytics</p>
              <h2>Participation and performance</h2>
            </div>
            <span className="toolbar__count" role="status">{groups.length} groups</span>
          </div>
          {groups.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Group</th>
                    <th scope="col">Course</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">Participating</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Attempt Average</th>
                    <th scope="col">Best Result</th>
                    <th scope="col">Latest Result</th>
                    <th scope="col">Awaiting review</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((row) => (
                    <tr key={row.groupCode}>
                      <th scope="row">{row.groupName}<br /><code>{row.groupCode}</code></th>
                      <td>{displayLabel(row.courseTitle, row.courseKey)}</td>
                      <td>{row.activeLearnerCount}</td>
                      <td>{row.participatingLearnerCount}</td>
                      <td>{row.attemptCount}</td>
                      <ScoreCell value={row.averageScorePercentage} />
                      <ScoreCell value={row.bestScorePercentage} />
                      <ScoreCell value={row.latestScorePercentage} />
                      <td>{row.requiresReviewCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No group analytics" body="No group analytics rows for the current filters." />
          )}
        </section>
      ) : null}

      {pane === "learners" ? (
        <div className={selectedLearner ? "analytics-split" : undefined}>
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Learner summary</p>
                <h2>Assignment participation in this scope</h2>
              </div>
              <span className="toolbar__count" role="status">{learners.length} learners</span>
            </div>
            {learners.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Learner</th>
                      <th scope="col">Group</th>
                      <th scope="col">Course</th>
                      <th scope="col">Activities Completed / Assigned</th>
                      <th scope="col">Completion</th>
                      <th scope="col">Latest Activity</th>
                      <th scope="col">Latest Result</th>
                      <th scope="col">Latest-result Average</th>
                      <th scope="col">Needs Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learners.map((row) => (
                      <tr
                        key={row.learnerId}
                        className={`analytics-row--selectable ${selectedLearnerId === row.learnerId ? "analytics-row--selected" : ""}`}
                        tabIndex={0}
                        aria-selected={selectedLearnerId === row.learnerId}
                        onClick={() => setSelectedLearnerId(row.learnerId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedLearnerId(row.learnerId);
                          }
                        }}
                      >
                        <th scope="row">{row.displayName}<br /><code>{row.studentNumber}</code></th>
                        <td>{row.groupName}</td>
                        <td>{row.courseTitle}</td>
                        <td>{row.completedCount} / {row.assignedCount}</td>
                        <td>{percentageLabel(row.completionPercentage)}</td>
                        <td>{displayLabel(row.latestActivityTitle, row.latestActivityKey ?? "—")}</td>
                        <td>{percentageLabel(row.latestResultPercentage)}</td>
                        <td>{percentageLabel(row.latestResultAveragePercentage)}</td>
                        <td>{row.requiresReviewCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No learner analytics" body="No learner analytics rows for the current filters." />
            )}
          </section>
          {selectedLearner ? <LearnerDetail learner={selectedLearner} onClose={() => setSelectedLearnerId(null)} /> : null}
        </div>
      ) : null}

      {pane === "activities" ? (
        <div className={selectedActivity ? "analytics-split" : undefined}>
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Activity analytics</p>
                <h2>Assigned versus attempted</h2>
              </div>
              <span className="toolbar__count" role="status">{activities.length} activities</span>
            </div>
            {activities.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Activity</th>
                      <th scope="col">Course</th>
                      <th scope="col">Group</th>
                      <th scope="col">Assigned</th>
                      <th scope="col">Participating</th>
                      <th scope="col">Completion</th>
                      <th scope="col">Attempts</th>
                      <th scope="col">Latest Result</th>
                      <th scope="col">Best Result</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((row) => {
                      const key = activityRowKey(row);
                      return (
                        <tr
                          key={key}
                          className={`analytics-row--selectable ${selectedAssignmentId === key || selectedAssignmentId === row.assignmentId ? "analytics-row--selected" : ""}`}
                          tabIndex={0}
                          aria-selected={selectedAssignmentId === key || selectedAssignmentId === row.assignmentId}
                          onClick={() => setSelectedAssignmentId(key)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedAssignmentId(key);
                            }
                          }}
                        >
                          <th scope="row">
                            <span className="table-primary">{displayLabel(row.activityTitle, row.activityKey)}</span>
                            <small>Version {row.activityVersion}{secondaryKey(row.activityTitle, row.activityKey) ? <> · <code>{row.activityKey}</code></> : null}</small>
                          </th>
                          <td>{displayLabel(row.courseTitle, row.courseKey)}</td>
                          <td>{displayLabel(row.groupName, row.groupCode)}</td>
                          <td>{row.assignedLearnerCount}</td>
                          <td>{row.attemptedLearnerCount}</td>
                          <td>{percentageLabel(row.completionPercentage)}</td>
                          <td>{row.attemptCount}</td>
                          <td>{percentageLabel(row.latestScorePercentage)}</td>
                          <td>{percentageLabel(row.bestScorePercentage)}</td>
                          <td>{row.requiresReviewCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No activity analytics" body="No activity analytics rows for the current filters." />
            )}
          </section>
          {selectedActivity ? (
            <ActivityDetail
              activity={selectedActivity}
              learners={selectedActivityLearners}
              questions={selectedActivityQuestions}
              questionScopeLabel={selectedActivity.groupName || selectedActivity.groupCode}
              onClose={() => setSelectedAssignmentId(null)}
            />
          ) : null}
        </div>
      ) : null}

      {pane === "questions" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Question analytics</p>
              <h2>{questionGrainLabel}</h2>
            </div>
            <span className="toolbar__count" role="status">{questionRows.length} questions</span>
          </div>
          {questionRows.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Activity</th>
                    {questionsAreGroupScoped(constrained) ? <th scope="col">Group</th> : null}
                    <th scope="col">Correct</th>
                    <th scope="col">Incorrect</th>
                    {questionsAreGroupScoped(constrained) ? <th scope="col">Not Answered</th> : null}
                    <th scope="col">Correct %</th>
                    <th scope="col">Review Required</th>
                    <th scope="col">Topics</th>
                    <th scope="col">Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {questionRows.map((row) => {
                    const groupRow = isGroupQuestion(row) ? row : null;
                    return (
                    <tr key={`${groupRow?.assignmentId ?? "platform"}:${row.activityKey}:${row.questionKey}`}>
                      <th scope="row">
                        <span className="table-primary">{displayLabel(groupRow?.questionTitle, row.questionKey)}</span>
                        {groupRow && secondaryKey(groupRow.questionTitle, row.questionKey) ? <small><code>{row.questionKey}</code></small> : null}
                      </th>
                      <td>{displayLabel(groupRow?.activityTitle, row.activityKey)}</td>
                      {questionsAreGroupScoped(constrained) ? <td>{groupRow?.groupName ?? "—"}</td> : null}
                      <td>{row.correctCount}</td>
                      <td>{row.incorrectCount}</td>
                      {questionsAreGroupScoped(constrained) ? <td>{groupRow?.unansweredCount ?? "—"}</td> : null}
                      <td>{percentageLabel(row.correctnessPercentage)}</td>
                      <td>{row.requiresReviewCount}</td>
                      <td>{row.topicKeys.join(", ") || "—"}</td>
                      <td>{row.skillKeys.join(", ") || "—"}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No question analytics" body="No question analytics rows for the current filters. Answer keys are never shown here." />
          )}
        </section>
      ) : null}

      {pane === "topics-skills" ? (
        <div className="analytics-split">
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Topic analytics</p>
                <h2>Existing topic keys only</h2>
              </div>
            </div>
            {topics.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Topic</th>
                      <th scope="col">Responses</th>
                      <th scope="col">Success</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((row) => (
                      <tr key={row.topicKey}>
                        <th scope="row"><code>{row.topicKey}</code></th>
                        <td>{row.responseCount}</td>
                        <td>{percentageLabel(row.successPercentage)}</td>
                        <td>{row.requiresReviewCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No topic coverage" body="No topic metadata coverage for the current filters." />
            )}
          </section>
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Skill analytics</p>
                <h2>Existing skill keys only</h2>
              </div>
            </div>
            {skills.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Skill</th>
                      <th scope="col">Responses</th>
                      <th scope="col">Success</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skills.map((row) => (
                      <tr key={row.skillKey}>
                        <th scope="row"><code>{row.skillKey}</code></th>
                        <td>{row.responseCount}</td>
                        <td>{percentageLabel(row.successPercentage)}</td>
                        <td>{row.requiresReviewCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No skill coverage" body="No skill metadata coverage for the current filters." />
            )}
          </section>
        </div>
      ) : null}

      {pane === "readiness" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Assessment readiness</p>
              <h2>Explainable indicators</h2>
            </div>
          </div>
          <p className="analytics-filter-note">
            Completion, latest-result average and review counts below follow the selected hub, course, group and activity.
            Topic coverage is a platform metadata indicator and is not inferred from free text.
            Recent trend uses learner-wide first/latest scores, not the selected activity.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Indicator</th>
                  <th scope="col">Value</th>
                  <th scope="col">Explanation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Completion</th>
                  <td>{percentageLabel(overview.completionPercentage)}</td>
                  <td>{METRIC_DEFINITIONS.completion.definition}</td>
                </tr>
                <tr>
                  <th scope="row">Latest-result average</th>
                  <td>{percentageLabel(overview.latestResultAverage)}</td>
                  <td>{METRIC_DEFINITIONS.latestResult.definition}</td>
                </tr>
                <tr>
                  <th scope="row">Awaiting review</th>
                  <td>{overview.awaitingReview}</td>
                  <td>{METRIC_DEFINITIONS.awaitingReview.definition}</td>
                </tr>
                {readiness.filter((item) => item.key === "topic-coverage" || item.key === "recent-trend").map((item) => (
                  <tr key={item.key}>
                    <th scope="row">{item.label}</th>
                    <td>
                      {item.unit === "percent"
                        ? percentageLabel(item.value)
                        : item.value == null
                          ? "—"
                          : String(item.value)}
                    </td>
                    <td>{item.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {pane === "attention" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Needs attention</p>
              <h2>Deterministic intervention signals</h2>
            </div>
            <span className="toolbar__count" role="status">{scopedSignals.length} signals</span>
          </div>
          {scopedSignals.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Signal</th>
                    <th scope="col">Entity</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedSignals.map((signal) => (
                    <tr key={`${signal.key}:${signal.entityType}:${signal.entityKey}`}>
                      <th scope="row">
                        <StatusBadge tone="warning" label="Needs attention" />
                        <br />
                        <code>{signal.key}</code>
                      </th>
                      <td>
                        {signal.entityType}
                        <br />
                        <code>{signal.entityKey}</code>
                      </td>
                      <td>{signal.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No attention signals" body="No deterministic attention signals for the current scope." />
          )}
        </section>
      ) : null}

      {pane !== "overview" ? <DefinitionList /> : null}
    </>
  );
}
