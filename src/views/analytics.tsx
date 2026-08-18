"use client";

import { useMemo, useState } from "react";
import type { AdminDataSnapshot } from "../api/admin-api";
import { StatusBadge } from "../components/status-badge";
import { getAdminModule } from "../router/modules";
import {
  assessmentOverviewFromSnapshot,
  assessmentReadinessFromSnapshot,
  interventionSignalsFromSnapshot,
} from "../results/from-admin-snapshot";
import { formatDate } from "../utils/format";

type AnalyticsPane =
  | "overview"
  | "groups"
  | "learners"
  | "activities"
  | "questions"
  | "topics-skills"
  | "readiness"
  | "attention";

function percentageLabel(value: number | null | undefined) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
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
      <div className="metric-card__label"><span aria-hidden="true" />{label}</div>
      <strong>{value}</strong>
      <p>{detail}</p>
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
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AnalyticsPage({ data }: { data: AdminDataSnapshot }) {
  const currentModule = getAdminModule("analytics");
  const [pane, setPane] = useState<AnalyticsPane>("overview");
  const [groupFilter, setGroupFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [skillFilter, setSkillFilter] = useState("all");

  const overview = assessmentOverviewFromSnapshot(data);
  const readiness = assessmentReadinessFromSnapshot(data);
  const signals = interventionSignalsFromSnapshot(data);

  const groupOptions = useMemo(
    () => [...new Set(data.groupPerformance.map((row) => row.groupCode))].sort(),
    [data.groupPerformance],
  );
  const courseOptions = useMemo(
    () => [...new Set(data.groupPerformance.map((row) => row.courseKey))].sort(),
    [data.groupPerformance],
  );
  const activityOptions = useMemo(
    () => [...new Set(data.activityAnalytics.map((row) => row.activityKey))].sort(),
    [data.activityAnalytics],
  );
  const topicOptions = useMemo(
    () => [...new Set(data.topicPerformance.map((row) => row.topicKey))].sort(),
    [data.topicPerformance],
  );
  const skillOptions = useMemo(
    () => [...new Set(data.skillPerformance.map((row) => row.skillKey))].sort(),
    [data.skillPerformance],
  );

  const groups = data.groupPerformance.filter(
    (row) =>
      (groupFilter === "all" || row.groupCode === groupFilter)
      && (courseFilter === "all" || row.courseKey === courseFilter),
  );
  const learners = data.learnerPerformance.filter(
    (row) => groupFilter === "all" || row.groupCodes.includes(groupFilter),
  );
  const activities = data.activityAnalytics.filter(
    (row) =>
      (groupFilter === "all" || row.groupCode === groupFilter)
      && (courseFilter === "all" || row.courseKey === courseFilter)
      && (activityFilter === "all" || row.activityKey === activityFilter),
  );
  const questions = data.questionPerformance.filter(
    (row) =>
      (activityFilter === "all" || row.activityKey === activityFilter)
      && (topicFilter === "all" || row.topicKeys.includes(topicFilter))
      && (skillFilter === "all" || row.skillKeys.includes(skillFilter)),
  );
  const topics = data.topicPerformance.filter(
    (row) => topicFilter === "all" || row.topicKey === topicFilter,
  );
  const skills = data.skillPerformance.filter(
    (row) => skillFilter === "all" || row.skillKey === skillFilter,
  );

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

      <section className="panel" aria-label="Analytics filters">
        <div className="toolbar">
          <FilterSelect id="analytics-group" label="Group" value={groupFilter} options={groupOptions} onChange={setGroupFilter} />
          <FilterSelect id="analytics-course" label="Course" value={courseFilter} options={courseOptions} onChange={setCourseFilter} />
          <FilterSelect id="analytics-activity" label="Activity" value={activityFilter} options={activityOptions} onChange={setActivityFilter} />
          <FilterSelect id="analytics-topic" label="Topic" value={topicFilter} options={topicOptions} onChange={setTopicFilter} />
          <FilterSelect id="analytics-skill" label="Skill" value={skillFilter} options={skillOptions} onChange={setSkillFilter} />
        </div>
      </section>

      {pane === "overview" ? (
        <>
          <section className="metrics-grid" aria-label="Assessment overview">
            <MetricCard label="Learners" value={String(overview?.activeLearners ?? data.dashboardSummary.activeLearners)} detail="Active learners" />
            <MetricCard label="Active groups" value={String(overview?.activeGroups ?? data.dashboardSummary.activeGroups)} detail="Teaching groups" />
            <MetricCard label="Attempts" value={String(overview?.attemptCount ?? data.dashboardSummary.completedAttempts)} detail="All recorded attempts" />
            <MetricCard label="Completion" value={percentageLabel(overview?.completionPercentage ?? null)} detail="Completed share of attempts" />
            <MetricCard label="Average result" value={percentageLabel(overview?.averageScorePercentage ?? data.dashboardSummary.averageScorePercentage)} detail="Completed attempt average" />
            <MetricCard label="Requires review" value={String(overview?.requiresReviewCount ?? 0)} detail="Unresolved response backlog" />
            <MetricCard label="Reviewed" value={String(overview?.reviewedResponseCount ?? 0)} detail="Teacher-marked responses" />
            <MetricCard label="Participation" value={String(overview?.participatingLearnerCount ?? 0)} detail="Learners with completed attempts" />
          </section>
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Backend-derived aggregates</p>
                <h2>Topic and skill links</h2>
              </div>
            </div>
            <p>
              Topic metadata: {overview?.topicMetadataCoverage ?? "absent"} ({overview?.topicLinkCount ?? 0} links).
              Skill metadata: {overview?.skillMetadataCoverage ?? "absent"} ({overview?.skillLinkCount ?? 0} links).
              Incomplete coverage is shown honestly and is never inferred from free text.
            </p>
          </section>
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
                    <th scope="col">Active</th>
                    <th scope="col">Participating</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Average</th>
                    <th scope="col">Best</th>
                    <th scope="col">Latest</th>
                    <th scope="col">Review backlog</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((row) => (
                    <tr key={row.groupCode}>
                      <th scope="row">{row.groupName}<br /><code>{row.groupCode}</code></th>
                      <td><code>{row.courseKey}</code></td>
                      <td>{row.activeLearnerCount}</td>
                      <td>{row.participatingLearnerCount}</td>
                      <td>{row.attemptCount}</td>
                      <td>{percentageLabel(row.averageScorePercentage)}</td>
                      <td>{percentageLabel(row.bestScorePercentage)}</td>
                      <td>{percentageLabel(row.latestScorePercentage)}</td>
                      <td>{row.requiresReviewCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No group analytics rows for the current filters.</p>
          )}
        </section>
      ) : null}

      {pane === "learners" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Learner analytics</p>
              <h2>Assignment participation and trends</h2>
            </div>
            <span className="toolbar__count" role="status">{learners.length} learners</span>
          </div>
          {learners.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Learner</th>
                    <th scope="col">Groups</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">Completed</th>
                    <th scope="col">First</th>
                    <th scope="col">Latest</th>
                    <th scope="col">Best</th>
                    <th scope="col">Average</th>
                    <th scope="col">Reviews</th>
                    <th scope="col">Latest activity</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((row) => (
                    <tr key={row.learnerId}>
                      <th scope="row">{row.displayName}<br /><code>{row.studentNumber}</code></th>
                      <td>{row.groupCodes.join(", ") || "—"}</td>
                      <td>{row.assignedActivityCount}</td>
                      <td>{row.completedActivityCount}</td>
                      <td>{percentageLabel(row.firstScorePercentage)}</td>
                      <td>{percentageLabel(row.latestScorePercentage)}</td>
                      <td>{percentageLabel(row.bestScorePercentage)}</td>
                      <td>{percentageLabel(row.averageScorePercentage)}</td>
                      <td>{row.requiresReviewCount}</td>
                      <td>{row.latestCompletedAt ? formatDate(row.latestCompletedAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No learner analytics rows for the current filters.</p>
          )}
        </section>
      ) : null}

      {pane === "activities" ? (
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
                    <th scope="col">Group</th>
                    <th scope="col">Assigned</th>
                    <th scope="col">Attempted</th>
                    <th scope="col">Completion</th>
                    <th scope="col">Attempts</th>
                    <th scope="col">Average</th>
                    <th scope="col">Latest</th>
                    <th scope="col">Best</th>
                    <th scope="col">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((row) => (
                    <tr key={`${row.groupCode}:${row.activityKey}:${row.activityVersion}`}>
                      <th scope="row"><code>{row.activityKey}</code><br />v{row.activityVersion}</th>
                      <td><code>{row.groupCode}</code></td>
                      <td>{row.assignedLearnerCount}</td>
                      <td>{row.attemptedLearnerCount}</td>
                      <td>
                        <span>{percentageLabel(row.completionPercentage)}</span>
                      </td>
                      <td>{row.attemptCount}</td>
                      <td>{percentageLabel(row.averageScorePercentage)}</td>
                      <td>{percentageLabel(row.latestScorePercentage)}</td>
                      <td>{percentageLabel(row.bestScorePercentage)}</td>
                      <td>{row.requiresReviewCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No activity analytics rows for the current filters.</p>
          )}
        </section>
      ) : null}

      {pane === "questions" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Question analytics</p>
              <h2>Correctness and review pressure</h2>
            </div>
            <span className="toolbar__count" role="status">{questions.length} questions</span>
          </div>
          {questions.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Type</th>
                    <th scope="col">Responses</th>
                    <th scope="col">Correctness</th>
                    <th scope="col">Avg score</th>
                    <th scope="col">Review</th>
                    <th scope="col">Topics</th>
                    <th scope="col">Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((row) => (
                    <tr key={`${row.activityKey}:${row.questionKey}`}>
                      <th scope="row"><code>{row.questionKey}</code></th>
                      <td>{row.questionType}</td>
                      <td>{row.responseCount}</td>
                      <td>{percentageLabel(row.correctnessPercentage)}</td>
                      <td>{row.averageAwardedScore == null ? "—" : row.averageAwardedScore.toFixed(2)}</td>
                      <td>{row.requiresReviewCount}</td>
                      <td>{row.topicKeys.join(", ") || "—"}</td>
                      <td>{row.skillKeys.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No question analytics rows for the current filters. Answer keys are never shown here.</p>
          )}
        </section>
      ) : null}

      {pane === "topics-skills" ? (
        <div className="split-panels">
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
              <p>No topic metadata coverage for the current filters.</p>
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
              <p>No skill metadata coverage for the current filters.</p>
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
                {readiness.map((item) => (
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
            <span className="toolbar__count" role="status">{signals.length} signals</span>
          </div>
          {signals.length ? (
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
                  {signals.map((signal) => (
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
            <p>No deterministic attention signals for the current demo or live aggregates.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
