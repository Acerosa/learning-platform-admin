"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  ActivityAnalyticsRecord,
  AdminDataSnapshot,
  GroupPerformanceRecord,
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
import {
  attentionEntityLabel,
  attentionReasonLabel,
  attentionTabForEntity,
  attemptDistribution,
  groupAverage,
  groupDerivedMetrics,
  latestResultDistribution,
  latestTimestamp,
  type AttentionTab,
  type DistributionBucket,
} from "../analytics/presentation.ts";
import { StatusBadge, type BadgeTone } from "../components/status-badge";
import { getAdminModule } from "../router/modules";
import {
  assessmentReadinessFromSnapshot,
  interventionSignalsFromSnapshot,
} from "../results/from-admin-snapshot";
import { formatDate } from "../utils/format";
import { ReadinessDiagnosticPage } from "./readiness-diagnostic";

type GroupTab = "overview" | "learners" | "activities" | "questions";
type ActivityTab = "overview" | "learners" | "questions";

function canUseSearchParams() {
  return typeof document !== "undefined"
    && document.querySelector('meta[name="learning-platform-admin-router"][content="hash"]') == null;
}

function statusTone(status: string): BadgeTone {
  if (status === "Complete") return "positive";
  if (status === "In progress") return "info";
  return "neutral";
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

function PaneTabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: ReadonlyArray<{ id: string; label: string }>;
}) {
  return (
    <div className="toolbar analytics-inner-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`button button--small ${value === item.id ? "button--primary" : "button--secondary"}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function DefinitionList({ compact = false }: { compact?: boolean }) {
  return (
    <section className="panel analytics-definitions" aria-label="Metric definitions">
      <details open={!compact}>
        <summary className="panel__header">
          <div>
            <p className="eyebrow">Metric definitions</p>
            <h2>How these figures are calculated</h2>
          </div>
        </summary>
        <dl className="analytics-definitions__list">
          {Object.values(METRIC_DEFINITIONS).map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.definition}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

function ScoreCell({ value }: { value: number | null | undefined }) {
  return <td>{percentageLabel(value)}</td>;
}

function SelectName({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="analytics-select" aria-pressed={selected} onClick={onSelect}>
      {children}
    </button>
  );
}

function DistributionPanel({
  title,
  totalLabel,
  buckets,
}: {
  title: string;
  totalLabel: string;
  buckets: readonly DistributionBucket[];
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (!total) return null;
  return (
    <section className="panel analytics-distribution" aria-label={title}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Distribution</p>
          <h2>{title}</h2>
          <p>{totalLabel}</p>
        </div>
      </div>
      <ul>
        {buckets.map((bucket) => {
          const width = total ? Math.round((1000 * bucket.count) / total) / 10 : 0;
          return (
            <li key={bucket.id}>
              <span>{bucket.label}</span>
              <span className="analytics-bar" aria-hidden="true">
                <span style={{ width: `${width}%` }} />
              </span>
              <span>{bucket.count}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function isGroupQuestion(
  row: QuestionPerformanceRecord | QuestionGroupPerformanceRecord,
): row is QuestionGroupPerformanceRecord {
  return "assignmentId" in row;
}

function QuestionTable({
  rows,
  caption,
  groupScoped,
}: {
  rows: readonly (QuestionPerformanceRecord | QuestionGroupPerformanceRecord)[];
  caption: string;
  groupScoped: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="analytics-caption">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Question</th>
            <th scope="col">Activity</th>
            {groupScoped ? <th scope="col">Group</th> : null}
            <th scope="col">Correct</th>
            <th scope="col">Incorrect</th>
            {groupScoped ? <th scope="col">Not Answered</th> : null}
            <th scope="col">Correct %</th>
            <th scope="col">Review</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => {
            const groupRow = isGroupQuestion(row) ? row : null;
            return (
              <tr key={`${groupRow?.assignmentId ?? "platform"}:${row.activityKey}:${row.questionKey}`}>
                <th scope="row">
                  <span className="table-primary">{displayLabel(groupRow?.questionTitle, row.questionKey)}</span>
                  {groupRow && secondaryKey(groupRow.questionTitle, row.questionKey) ? <small><code>{row.questionKey}</code></small> : null}
                </th>
                <td>{displayLabel(groupRow?.activityTitle, row.activityKey)}</td>
                {groupScoped ? <td>{groupRow?.groupName ?? "—"}</td> : null}
                <td>{row.correctCount}</td>
                <td>{row.incorrectCount}</td>
                {groupScoped ? <td>{groupRow?.unansweredCount ?? "—"}</td> : null}
                <td>{percentageLabel(row.correctnessPercentage)}</td>
                <td>{row.requiresReviewCount || "—"}</td>
              </tr>
            );
          }) : (
            <tr><td colSpan={groupScoped ? 8 : 6}>No question aggregates for this scope. Answer keys are never shown here.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LearnerResultsTable({
  learners,
}: {
  learners: readonly LearnerActivityPerformanceRecord[];
}) {
  return (
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
            <th scope="col">Attempt Average</th>
            <th scope="col">Review</th>
            <th scope="col">Last Attempt</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {learners.length ? learners.map((row) => {
            const status = learnerActivityStatus(row);
            return (
              <tr key={row.learnerId}>
                <th scope="row">{row.displayName}</th>
                <td>{row.attemptCount}</td>
                <ScoreCell value={row.firstScorePercentage} />
                <ScoreCell value={row.latestScorePercentage} />
                <ScoreCell value={row.bestScorePercentage} />
                <ScoreCell value={row.averageScorePercentage} />
                <td>{row.requiresReviewCount || "—"}</td>
                <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
                <td><StatusBadge tone={statusTone(status)} label={status} /></td>
              </tr>
            );
          }) : (
            <tr><td colSpan={9}>No assigned learners in this activity scope.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LearnerDetail({
  learner,
  onClose,
  onOpenActivity,
}: {
  learner: LearnerSummaryRow;
  onClose: () => void;
  onOpenActivity?: (assignmentId: string) => void;
}) {
  const best = learner.rows
    .map((row) => row.bestScorePercentage)
    .filter((value): value is number => value != null);
  const bestResult = best.length ? Math.max(...best) : null;
  const lastCompleted = [...learner.rows]
    .filter((row) => row.latestCompletedAt)
    .sort((left, right) => (right.latestCompletedAt ?? "").localeCompare(left.latestCompletedAt ?? ""))[0];
  const focusRow = lastCompleted ?? learner.rows[0];

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
          Back
        </button>
      </div>
      <section className="metrics-grid metrics-grid--compact" aria-label="Learner summary">
        <MetricCard label="Completed" value={String(learner.completedCount)} detail="Activities with a completed attempt" definition={METRIC_DEFINITIONS.completion.definition} />
        <MetricCard label="Assigned" value={String(learner.assignedCount)} detail="Activities assigned in this scope" />
        <MetricCard label="Latest Result" value={percentageLabel(learner.latestResultPercentage)} detail={METRIC_DEFINITIONS.latestResult.definition} definition={METRIC_DEFINITIONS.latestResult.definition} />
        <MetricCard label="Attempt Average" value={percentageLabel(learner.attemptAveragePercentage)} detail={METRIC_DEFINITIONS.attemptAverage.definition} definition={METRIC_DEFINITIONS.attemptAverage.definition} />
        <MetricCard label="Best Result" value={percentageLabel(bestResult)} detail={METRIC_DEFINITIONS.bestResult.definition} definition={METRIC_DEFINITIONS.bestResult.definition} />
        <MetricCard label="Awaiting Review" value={String(learner.requiresReviewCount)} detail={METRIC_DEFINITIONS.awaitingReview.definition} definition={METRIC_DEFINITIONS.awaitingReview.definition} />
      </section>
      <div className="table-wrap">
        <table>
          <caption className="analytics-caption">Activity performance</caption>
          <thead>
            <tr>
              <th scope="col">Activity</th>
              <th scope="col">Attempts</th>
              <th scope="col">First Result</th>
              <th scope="col">Latest Result</th>
              <th scope="col">Best Result</th>
              <th scope="col">Attempt Average</th>
              <th scope="col">Status</th>
              <th scope="col">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {learner.rows.map((row) => {
              const status = learnerActivityStatus(row);
              return (
                <tr key={row.assignmentId} className={onOpenActivity ? "analytics-row--linked" : undefined}>
                  <th scope="row">
                    {onOpenActivity ? (
                      <SelectName selected={false} onSelect={() => onOpenActivity(row.assignmentId)}>
                        <span className="table-primary">{displayLabel(row.activityTitle, row.activityKey)}</span>
                        {secondaryKey(row.activityTitle, row.activityKey) ? <small><code>{row.activityKey}</code></small> : null}
                      </SelectName>
                    ) : (
                      <>
                        <span className="table-primary">{displayLabel(row.activityTitle, row.activityKey)}</span>
                        {secondaryKey(row.activityTitle, row.activityKey) ? <small><code>{row.activityKey}</code></small> : null}
                      </>
                    )}
                  </th>
                  <td>{row.attemptCount}</td>
                  <ScoreCell value={row.firstScorePercentage} />
                  <ScoreCell value={row.latestScorePercentage} />
                  <ScoreCell value={row.bestScorePercentage} />
                  <ScoreCell value={row.averageScorePercentage} />
                  <td><StatusBadge tone={statusTone(status)} label={status} /></td>
                  <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="analytics-metric-split" aria-label="Performance and engagement">
        <section>
          <h3>Performance</h3>
          <ul>
            <li><span>First Result</span><strong>{percentageLabel(focusRow?.firstScorePercentage)}</strong></li>
            <li><span>Latest Result</span><strong>{percentageLabel(focusRow?.latestScorePercentage)}</strong></li>
            <li><span>Best Result</span><strong>{percentageLabel(focusRow?.bestScorePercentage)}</strong></li>
            <li><span>Attempt Average</span><strong>{percentageLabel(focusRow?.averageScorePercentage)}</strong></li>
          </ul>
        </section>
        <section>
          <h3>Engagement</h3>
          <ul>
            <li><span>Attempts</span><strong>{focusRow?.attemptCount ?? 0}</strong></li>
            <li><span>Completed attempts</span><strong>{focusRow?.completedAttemptCount ?? 0}</strong></li>
            <li><span>Last attempt</span><strong>{focusRow?.latestCompletedAt ? formatDate(focusRow.latestCompletedAt) : "—"}</strong></li>
            <li><span>First attempt</span><strong>{focusRow?.firstCompletedAt ? formatDate(focusRow.firstCompletedAt) : "—"}</strong></li>
          </ul>
        </section>
      </div>
    </section>
  );
}

function ActivityDetail({
  activity,
  learners,
  questions,
  questionScopeLabel,
  tab,
  onTab,
  onClose,
  onOpenLearner,
}: {
  activity: ActivityAnalyticsRecord;
  learners: readonly LearnerActivityPerformanceRecord[];
  questions: readonly QuestionGroupPerformanceRecord[];
  questionScopeLabel: string;
  tab: ActivityTab;
  onTab: (tab: ActivityTab) => void;
  onClose: () => void;
  onOpenLearner?: (learnerId: string) => void;
}) {
  const resultBuckets = latestResultDistribution(learners);
  const attemptBuckets = attemptDistribution(learners);

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
          {secondaryKey(activity.activityTitle, activity.activityKey) ? <p><code>{activity.activityKey}</code></p> : null}
        </div>
        <button type="button" className="button button--small button--secondary" onClick={onClose}>
          Back
        </button>
      </div>
      <PaneTabs
        value={tab}
        onChange={(value) => onTab(value as ActivityTab)}
        items={[
          { id: "overview", label: "Overview" },
          { id: "learners", label: "Learners" },
          { id: "questions", label: "Questions" },
        ]}
      />
      {tab === "overview" ? (
        <>
          <section className="metrics-grid metrics-grid--compact" aria-label="Activity summary">
            <MetricCard label="Assigned" value={String(activity.assignedLearnerCount)} detail="Assigned learners" />
            <MetricCard label="Participating" value={`${activity.attemptedLearnerCount} / ${percentageLabel(activity.participationPercentage ?? null)}`} detail={METRIC_DEFINITIONS.participation.definition} definition={METRIC_DEFINITIONS.participation.definition} />
            <MetricCard label="Completed" value={String(activity.completedLearnerCount)} detail="Learners with a completed attempt" />
            <MetricCard label="Completion" value={percentageLabel(activity.completionPercentage)} detail={METRIC_DEFINITIONS.completion.definition} definition={METRIC_DEFINITIONS.completion.definition} />
            <MetricCard label="Latest-result Average" value={percentageLabel(activity.latestScorePercentage)} detail={METRIC_DEFINITIONS.latestResult.definition} definition={METRIC_DEFINITIONS.latestResult.definition} />
            <MetricCard label={METRIC_DEFINITIONS.highestResult.label} value={percentageLabel(activity.bestScorePercentage)} detail={METRIC_DEFINITIONS.highestResult.definition} definition={METRIC_DEFINITIONS.highestResult.definition} />
            <MetricCard label="Awaiting review" value={String(activity.requiresReviewCount)} detail={METRIC_DEFINITIONS.awaitingReview.definition} definition={METRIC_DEFINITIONS.awaitingReview.definition} />
          </section>
          <div className="analytics-visuals">
            <DistributionPanel title="Results distribution (Latest Result)" totalLabel={`${learners.length} assigned learners`} buckets={resultBuckets} />
            <DistributionPanel title="Attempt distribution" totalLabel="Assigned learners by recorded attempts" buckets={attemptBuckets} />
          </div>
        </>
      ) : null}
      {tab === "learners" ? (
        onOpenLearner ? (
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
                  <th scope="col">Attempt Average</th>
                  <th scope="col">Review</th>
                  <th scope="col">Last Attempt</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((row) => {
                  const status = learnerActivityStatus(row);
                  return (
                    <tr key={row.learnerId}>
                      <th scope="row">
                        <SelectName selected={false} onSelect={() => onOpenLearner(row.learnerId)}>
                          {row.displayName}
                        </SelectName>
                      </th>
                      <td>{row.attemptCount}</td>
                      <ScoreCell value={row.firstScorePercentage} />
                      <ScoreCell value={row.latestScorePercentage} />
                      <ScoreCell value={row.bestScorePercentage} />
                      <ScoreCell value={row.averageScorePercentage} />
                      <td>{row.requiresReviewCount || "—"}</td>
                      <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
                      <td><StatusBadge tone={statusTone(status)} label={status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <LearnerResultsTable learners={learners} />
      ) : null}
      {tab === "questions" ? (
        <QuestionTable
          rows={questions}
          caption={`Questions · ${questionScopeLabel}`}
          groupScoped
        />
      ) : null}
    </section>
  );
}

function GroupDetail({
  group,
  metrics,
  learners,
  activities,
  questions,
  tab,
  onTab,
  onClose,
  onOpenLearner,
  onOpenActivity,
}: {
  group: GroupPerformanceRecord;
  metrics: ReturnType<typeof groupDerivedMetrics>;
  learners: readonly LearnerSummaryRow[];
  activities: readonly ActivityAnalyticsRecord[];
  questions: readonly QuestionGroupPerformanceRecord[];
  tab: GroupTab;
  onTab: (tab: GroupTab) => void;
  onClose: () => void;
  onOpenLearner: (learnerId: string) => void;
  onOpenActivity: (assignmentId: string) => void;
}) {
  return (
    <section className="panel analytics-detail" aria-label={`${group.groupName} group analytics`}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Group</p>
          <h2>{group.groupName}</h2>
          <p>{displayLabel(group.courseTitle, group.courseKey)} · <code>{group.groupCode}</code></p>
        </div>
        <button type="button" className="button button--small button--secondary" onClick={onClose}>
          Back
        </button>
      </div>
      <PaneTabs
        value={tab}
        onChange={(value) => onTab(value as GroupTab)}
        items={[
          { id: "overview", label: "Overview" },
          { id: "learners", label: "Learners" },
          { id: "activities", label: "Activities" },
          { id: "questions", label: "Questions" },
        ]}
      />
      {tab === "overview" ? (
        <>
          <section className="metrics-grid metrics-grid--compact" aria-label="Group summary">
            <MetricCard label="Learners" value={String(metrics.assignedLearners)} detail="Assigned" />
            <MetricCard label="Participating" value={String(metrics.participatingLearners)} detail={METRIC_DEFINITIONS.participation.definition} definition={METRIC_DEFINITIONS.participation.definition} />
            <MetricCard label="Completed" value={String(metrics.completedLearners)} detail={METRIC_DEFINITIONS.completion.definition} definition={METRIC_DEFINITIONS.completion.definition} />
            <MetricCard label="Latest-result Average" value={percentageLabel(metrics.latestResultAverage)} detail={METRIC_DEFINITIONS.latestResult.definition} definition={METRIC_DEFINITIONS.latestResult.definition} />
            <MetricCard label={METRIC_DEFINITIONS.highestResult.label} value={percentageLabel(metrics.bestResultAverage)} detail={METRIC_DEFINITIONS.highestResult.definition} definition={METRIC_DEFINITIONS.highestResult.definition} />
            <MetricCard label="Awaiting review" value={String(metrics.awaitingReview)} detail={METRIC_DEFINITIONS.awaitingReview.definition} definition={METRIC_DEFINITIONS.awaitingReview.definition} />
          </section>
          <DistributionPanel
            title="Results distribution (Latest Result)"
            totalLabel={`${learners.length} learners in this group`}
            buckets={latestResultDistribution(learners.flatMap((row) => row.rows))}
          />
          <div className="table-wrap">
            <table>
              <caption className="analytics-caption">Activity performance</caption>
              <thead>
                <tr>
                  <th scope="col">Activity</th>
                  <th scope="col">Assigned</th>
                  <th scope="col">Participating</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Completion</th>
                  <th scope="col">Latest Result</th>
                  <th scope="col">{METRIC_DEFINITIONS.highestResult.label}</th>
                  <th scope="col">Awaiting Review</th>
                  <th scope="col">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((row) => (
                  <tr key={activityRowKey(row)}>
                    <th scope="row">
                      <SelectName selected={false} onSelect={() => onOpenActivity(activityRowKey(row))}>
                        <span className="table-primary">{displayLabel(row.activityTitle, row.activityKey)}</span>
                        <small>Version {row.activityVersion}</small>
                      </SelectName>
                    </th>
                    <td>{row.assignedLearnerCount}</td>
                    <td>{row.attemptedLearnerCount}</td>
                    <td>{row.completedLearnerCount}</td>
                    <td>{percentageLabel(row.completionPercentage)}</td>
                    <ScoreCell value={row.latestScorePercentage} />
                    <ScoreCell value={row.bestScorePercentage} />
                    <td>{row.requiresReviewCount}</td>
                    <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {tab === "learners" ? (
        <div className="table-wrap">
          <table>
            <caption className="analytics-caption">Learners in this group</caption>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Completed / Assigned</th>
                <th scope="col">Completion</th>
                <th scope="col">Latest Result</th>
                <th scope="col">Needs Review</th>
                <th scope="col">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((row) => (
                <tr key={row.learnerId}>
                  <th scope="row">
                    <SelectName selected={false} onSelect={() => onOpenLearner(row.learnerId)}>
                      {row.displayName}
                      <small><code>{row.studentNumber}</code></small>
                    </SelectName>
                  </th>
                  <td>{row.completedCount} / {row.assignedCount}</td>
                  <td>{percentageLabel(row.completionPercentage)}</td>
                  <ScoreCell value={row.latestResultPercentage} />
                  <td>{row.requiresReviewCount}</td>
                  <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "activities" ? (
        <div className="table-wrap">
          <table>
            <caption className="analytics-caption">Activities assigned to this group</caption>
            <thead>
              <tr>
                <th scope="col">Activity</th>
                <th scope="col">Assigned</th>
                <th scope="col">Completion</th>
                <th scope="col">Latest-result Average</th>
                <th scope="col">Awaiting Review</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((row) => (
                <tr key={activityRowKey(row)}>
                  <th scope="row">
                    <SelectName selected={false} onSelect={() => onOpenActivity(activityRowKey(row))}>
                      {displayLabel(row.activityTitle, row.activityKey)}
                    </SelectName>
                  </th>
                  <td>{row.assignedLearnerCount}</td>
                  <td>{percentageLabel(row.completionPercentage)}</td>
                  <ScoreCell value={row.latestScorePercentage} />
                  <td>{row.requiresReviewCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "questions" ? (
        <QuestionTable rows={questions} caption={`Questions · ${group.groupName}`} groupScoped />
      ) : null}
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
  const [selectedGroupCode, setSelectedGroupCode] = useState<string | null>(initial.inspectGroup ?? null);
  const [groupTab, setGroupTab] = useState<GroupTab>("overview");
  const [activityTab, setActivityTab] = useState<ActivityTab>("overview");
  const [attentionTab, setAttentionTab] = useState<AttentionTab>("learner");

  const constrained = useMemo(() => constrainScope(scope, data), [data, scope]);
  const activeFilters = PANE_FILTERS[pane];
  const overview = useMemo(() => scopedOverview(data, constrained), [constrained, data]);
  const readiness = assessmentReadinessFromSnapshot(data);
  const signals = interventionSignalsFromSnapshot(data);
  const groups = useMemo(() => scopedGroups(data, constrained), [constrained, data]);
  const learners = useMemo(() => learnerSummaries(data, constrained), [constrained, data]);
  const activities = useMemo(() => scopedActivities(data, constrained), [constrained, data]);
  const learnerActivity = useMemo(() => scopedLearnerActivity(data, constrained), [constrained, data]);
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
  const selectedGroup = groups.find((row) => row.groupCode === selectedGroupCode) ?? null;
  const selectedActivityLearners = selectedActivity
    ? learnerActivity.filter((row) =>
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
      inspectGroup: selectedGroupCode,
    });
    if (window.location.search !== next) {
      window.history.replaceState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
    }
  }, [constrained, pane, selectedAssignmentId, selectedGroupCode, selectedLearnerId]);

  function updateScope(patch: Partial<AnalyticsScope>) {
    setScope((current) => constrainScope({ ...current, ...patch }, data));
    setSelectedLearnerId(null);
    setSelectedAssignmentId(null);
    setSelectedGroupCode(null);
  }

  function focusLearner(learnerId: string) {
    setSelectedLearnerId(learnerId);
    setPane("learners");
  }

  function focusActivity(assignmentId: string) {
    setSelectedAssignmentId(assignmentId);
    setPane("activities");
    setActivityTab("overview");
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
    { id: "readiness-diagnostic", label: "Readiness Diagnostic" },
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
  const attentionByTab = scopedSignals.filter((signal) => attentionTabForEntity(signal.entityType) === attentionTab);
  const groupSummary = groupAverage(groups);
  const resultBuckets = latestResultDistribution(learnerActivity);

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

      {pane !== "readiness-diagnostic" ? (
      <section className="panel" aria-label="Analytics filters">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Narrow the current teaching context</h2>
          </div>
          <button
            type="button"
            className="button button--small button--secondary"
            onClick={() => {
              setScope(EMPTY_SCOPE);
              setSelectedLearnerId(null);
              setSelectedAssignmentId(null);
              setSelectedGroupCode(null);
            }}
          >
            Reset filters
          </button>
        </div>
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
      ) : null}

      {pane !== "readiness-diagnostic" ? (
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
        </div>
      </section>
      ) : null}

      <div className="toolbar" role="tablist" aria-label="Analytics views">
        {panes.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={pane === item.id}
            className={`button button--small ${pane === item.id ? "button--primary" : "button--secondary"}`}
            onClick={() => setPane(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {pane === "overview" ? (
        <>
          <section className="metrics-grid" aria-label="Assessment overview">
            <MetricCard label="Learners" value={String(overview.assignedLearners)} detail="Assigned in this scope" />
            <MetricCard label="Participating" value={`${overview.participatingLearners} / ${percentageLabel(overview.participationPercentage)}`} detail={METRIC_DEFINITIONS.participation.definition} definition={METRIC_DEFINITIONS.participation.definition} />
            <MetricCard label="Completed" value={String(overview.completedLearners)} detail="Learners with a completed attempt" />
            <MetricCard label="Completion" value={percentageLabel(overview.completionPercentage)} detail={METRIC_DEFINITIONS.completion.definition} definition={METRIC_DEFINITIONS.completion.definition} />
            <MetricCard label="Latest-result Average" value={percentageLabel(overview.latestResultAverage)} detail={METRIC_DEFINITIONS.latestResult.definition} definition={METRIC_DEFINITIONS.latestResult.definition} />
            <MetricCard label={METRIC_DEFINITIONS.bestResultAverage.label} value={percentageLabel(overview.bestResultAverage)} detail={METRIC_DEFINITIONS.bestResultAverage.definition} definition={METRIC_DEFINITIONS.bestResultAverage.definition} />
            <MetricCard label="Attempts" value={String(overview.attemptCount)} detail={METRIC_DEFINITIONS.attempts.definition} definition={METRIC_DEFINITIONS.attempts.definition} />
            <MetricCard label="Awaiting review" value={String(overview.awaitingReview)} detail={METRIC_DEFINITIONS.awaitingReview.definition} definition={METRIC_DEFINITIONS.awaitingReview.definition} />
          </section>
          {learnerActivity.length ? (
            <DistributionPanel
              title="Results distribution (Latest Result)"
              totalLabel={`${overview.assignedLearners} learners in this scope`}
              buckets={resultBuckets}
            />
          ) : null}
          <nav className="card-grid card-grid--3" aria-label="Analytics sections">
            {([
              ["groups", "Groups", "Participation and performance by teaching group"],
              ["learners", "Learners", "Assignment-level learner summaries and drill-down"],
              ["activities", "Activities", "Assigned, participating and completed work"],
              ["questions", "Questions", questionGrainLabel],
              ["attention", "Needs attention", "Deterministic signals for teaching follow-up"],
            ] as const).map(([id, title, body]) => (
              <button key={id} type="button" className="insight-card analytics-nav-card" onClick={() => setPane(id)}>
                <span className="eyebrow">{title}</span>
                <h2>{title}</h2>
                <p>{body}</p>
              </button>
            ))}
          </nav>
          <DefinitionList />
        </>
      ) : null}

      {pane === "groups" ? (
        <div className={selectedGroup ? "analytics-split" : undefined}>
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Groups analytics</p>
                <h2>Teaching groups in this scope</h2>
              </div>
              <span className="toolbar__count" role="status">{groups.length} groups</span>
            </div>
            <section className="metrics-grid metrics-grid--compact" aria-label="Group totals">
              <MetricCard label="Groups" value={String(groups.length)} detail="Groups matching the current filters" />
              <MetricCard label="Learners" value={String(groupSummary.learners)} detail="Assigned learners across these groups" />
              <MetricCard label="Latest-result Average" value={percentageLabel(groupSummary.latest)} detail={METRIC_DEFINITIONS.latestResult.definition} definition={METRIC_DEFINITIONS.latestResult.definition} />
              <MetricCard label={METRIC_DEFINITIONS.highestResult.label} value={percentageLabel(groupSummary.highest)} detail={METRIC_DEFINITIONS.highestResult.definition} definition={METRIC_DEFINITIONS.highestResult.definition} />
              <MetricCard label="Awaiting review" value={String(groupSummary.review)} detail={METRIC_DEFINITIONS.awaitingReview.definition} definition={METRIC_DEFINITIONS.awaitingReview.definition} />
            </section>
            {groups.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Group</th>
                      <th scope="col">Course</th>
                      <th scope="col">Learners</th>
                      <th scope="col">Completed</th>
                      <th scope="col">Completion</th>
                      <th scope="col">Latest-result Average</th>
                      <th scope="col">{METRIC_DEFINITIONS.highestResult.label}</th>
                      <th scope="col">Needs Review</th>
                      <th scope="col">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((row) => {
                      const derived = groupDerivedMetrics(row, learnerActivity, activities);
                      return (
                        <tr key={row.groupCode} className={selectedGroupCode === row.groupCode ? "analytics-row--selected" : undefined}>
                          <th scope="row">
                            <SelectName selected={selectedGroupCode === row.groupCode} onSelect={() => { setSelectedGroupCode(row.groupCode); setGroupTab("overview"); }}>
                              <span className="table-primary">{row.groupName}</span>
                              <small><code>{row.groupCode}</code></small>
                            </SelectName>
                          </th>
                          <td>{displayLabel(row.courseTitle, row.courseKey)}</td>
                          <td>{row.activeLearnerCount}</td>
                          <td>{derived.completedLearners}</td>
                          <td>{percentageLabel(derived.completionPercentage)}</td>
                          <ScoreCell value={row.latestScorePercentage} />
                          <ScoreCell value={row.bestScorePercentage} />
                          <td>{row.requiresReviewCount}</td>
                          <td>{derived.lastActivity ? formatDate(derived.lastActivity) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No group analytics" body="No group analytics rows for the current filters." />
            )}
          </section>
          {selectedGroup ? (
            <GroupDetail
              group={selectedGroup}
              metrics={groupDerivedMetrics(selectedGroup, learnerActivity, activities)}
              learners={learners.filter((row) => row.groupCode === selectedGroup.groupCode)}
              activities={activities.filter((row) => row.groupCode === selectedGroup.groupCode)}
              questions={groupQuestions.filter((row) => row.groupCode === selectedGroup.groupCode)}
              tab={groupTab}
              onTab={setGroupTab}
              onClose={() => setSelectedGroupCode(null)}
              onOpenLearner={focusLearner}
              onOpenActivity={focusActivity}
            />
          ) : null}
        </div>
      ) : null}

      {pane === "learners" ? (
        <div className={selectedLearner ? "analytics-split" : undefined}>
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Learners analytics</p>
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
                      <th scope="col">Completed / Assigned</th>
                      <th scope="col">Completion</th>
                      <th scope="col">Latest Activity</th>
                      <th scope="col">Latest Result</th>
                      <th scope="col">Latest-result Average</th>
                      <th scope="col">Needs Review</th>
                      <th scope="col">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learners.map((row) => (
                      <tr key={row.learnerId} className={selectedLearnerId === row.learnerId ? "analytics-row--selected" : undefined}>
                        <th scope="row">
                          <SelectName selected={selectedLearnerId === row.learnerId} onSelect={() => setSelectedLearnerId(row.learnerId)}>
                            <span className="table-primary">{row.displayName}</span>
                            <small><code>{row.studentNumber}</code></small>
                          </SelectName>
                        </th>
                        <td>{row.groupName}</td>
                        <td>{row.courseTitle}</td>
                        <td>{row.completedCount} / {row.assignedCount}</td>
                        <td>{percentageLabel(row.completionPercentage)}</td>
                        <td>{displayLabel(row.latestActivityTitle, row.latestActivityKey ?? "—")}</td>
                        <td>{percentageLabel(row.latestResultPercentage)}</td>
                        <td>{percentageLabel(row.latestResultAveragePercentage)}</td>
                        <td>{row.requiresReviewCount}</td>
                        <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No learner analytics" body="No learner analytics rows for the current filters." />
            )}
          </section>
          {selectedLearner ? (
            <LearnerDetail
              learner={selectedLearner}
              onClose={() => setSelectedLearnerId(null)}
              onOpenActivity={focusActivity}
            />
          ) : null}
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
                      <th scope="col">Completed</th>
                      <th scope="col">Completion</th>
                      <th scope="col">Latest-result Average</th>
                      <th scope="col">{METRIC_DEFINITIONS.highestResult.label}</th>
                      <th scope="col">Awaiting Review</th>
                      <th scope="col">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((row) => {
                      const key = activityRowKey(row);
                      const selected = selectedAssignmentId === key || selectedAssignmentId === row.assignmentId;
                      return (
                        <tr key={key} className={selected ? "analytics-row--selected" : undefined}>
                          <th scope="row">
                            <SelectName selected={selected} onSelect={() => { setSelectedAssignmentId(key); setActivityTab("overview"); }}>
                              <span className="table-primary">{displayLabel(row.activityTitle, row.activityKey)}</span>
                              <small>Version {row.activityVersion}{secondaryKey(row.activityTitle, row.activityKey) ? <> · <code>{row.activityKey}</code></> : null}</small>
                            </SelectName>
                          </th>
                          <td>{displayLabel(row.courseTitle, row.courseKey)}</td>
                          <td>{displayLabel(row.groupName, row.groupCode)}</td>
                          <td>{row.assignedLearnerCount}</td>
                          <td>{row.attemptedLearnerCount}</td>
                          <td>{row.completedLearnerCount}</td>
                          <td>{percentageLabel(row.completionPercentage)}</td>
                          <td>{percentageLabel(row.latestScorePercentage)}</td>
                          <td>{percentageLabel(row.bestScorePercentage)}</td>
                          <td>{row.requiresReviewCount}</td>
                          <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
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
              tab={activityTab}
              onTab={setActivityTab}
              onClose={() => setSelectedAssignmentId(null)}
              onOpenLearner={focusLearner}
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
              {constrained.activityKey !== ALL_SCOPE ? (
                <p>
                  {displayLabel(
                    activities.find((row) => row.activityKey === constrained.activityKey)?.activityTitle,
                    constrained.activityKey,
                  )}
                  {constrained.groupCode !== ALL_SCOPE ? ` · ${displayLabel(groups.find((row) => row.groupCode === constrained.groupCode)?.groupName, constrained.groupCode)}` : ""}
                </p>
              ) : null}
            </div>
            <span className="toolbar__count" role="status">{questionRows.length} questions</span>
          </div>
          {questionRows.length ? (
            <QuestionTable rows={questionRows} caption={questionGrainLabel} groupScoped={questionsAreGroupScoped(constrained)} />
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
                <p className="eyebrow">Topics & skills</p>
                <h2>Existing metadata keys only</h2>
                <p>This view is broader-grain than group or activity analytics and is not inferred from free text.</p>
              </div>
            </div>
            {topics.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Topic</th>
                      <th scope="col">Learners Covered</th>
                      <th scope="col">Success</th>
                      <th scope="col">Needs Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((row) => (
                      <tr key={row.topicKey}>
                        <th scope="row"><code>{row.topicKey}</code></th>
                        <td>{row.learnerCount}</td>
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
                <p className="eyebrow">Skills</p>
                <h2>Existing skill keys only</h2>
              </div>
            </div>
            {skills.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Skill</th>
                      <th scope="col">Learners Covered</th>
                      <th scope="col">Success</th>
                      <th scope="col">Needs Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skills.map((row) => (
                      <tr key={row.skillKey}>
                        <th scope="row"><code>{row.skillKey}</code></th>
                        <td>{row.learnerCount}</td>
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

      {pane === "readiness-diagnostic" ? (
        <ReadinessDiagnosticPage
          sessions={data.diagnosticSessions}
          responses={data.diagnosticResponses}
          summaries={data.diagnosticSummary}
        />
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
          <PaneTabs
            value={attentionTab}
            onChange={(value) => setAttentionTab(value as AttentionTab)}
            items={[
              { id: "learner", label: "Learners" },
              { id: "group", label: "Groups" },
              { id: "activity", label: "Activities" },
              ...(scopedSignals.some((signal) => attentionTabForEntity(signal.entityType) === "other")
                ? [{ id: "other", label: "Other" }]
                : []),
            ]}
          />
          {attentionByTab.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{attentionTab === "group" ? "Group" : attentionTab === "activity" ? "Activity" : attentionTab === "learner" ? "Learner" : "Entity"}</th>
                    <th scope="col">Group</th>
                    <th scope="col">Course</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Detail</th>
                    <th scope="col">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionByTab.map((signal) => {
                    const learner = learners.find((row) => row.studentNumber === signal.entityKey);
                    const group = signal.entityType === "group"
                      ? groups.find((row) => row.groupCode === signal.entityKey)
                      : signal.entityType === "activity"
                        ? groups.find((row) => signal.entityKey.startsWith(`${row.groupCode}:`))
                        : learner
                          ? groups.find((row) => row.groupCode === learner.groupCode)
                          : undefined;
                    const last = signal.entityType === "learner"
                      ? learner?.latestCompletedAt
                      : signal.entityType === "group" && group
                        ? groupDerivedMetrics(group, learnerActivity, activities).lastActivity
                        : latestTimestamp(activities.filter((row) => `${row.groupCode}:${row.activityKey}` === signal.entityKey).map((row) => row.latestCompletedAt));
                    return (
                      <tr key={`${signal.key}:${signal.entityType}:${signal.entityKey}`}>
                        <th scope="row">
                          <span className="table-primary">{attentionEntityLabel(signal, { learners, groups, activities })}</span>
                          <small><code>{signal.entityKey}</code></small>
                        </th>
                        <td>{group?.groupName ?? (learner?.groupName ?? "—")}</td>
                        <td>{group ? displayLabel(group.courseTitle, group.courseKey) : (learner?.courseTitle ?? "—")}</td>
                        <td><StatusBadge tone="warning" label={attentionReasonLabel(signal.key)} /></td>
                        <td>{signal.reason}</td>
                        <td>{last ? formatDate(last) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No attention signals" body="No deterministic attention signals for this tab in the current scope." />
          )}
        </section>
      ) : null}

      {pane !== "overview" && pane !== "readiness-diagnostic" ? <DefinitionList compact /> : null}
    </>
  );
}
