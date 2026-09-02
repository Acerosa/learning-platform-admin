import type {
  ActivityAnalyticsRecord,
  GroupPerformanceRecord,
  LearnerActivityPerformanceRecord,
} from "../api/admin-api.ts";
import { displayLabel, mean } from "./metrics.ts";

export const RESULT_BUCKETS = Object.freeze([
  { id: "high", label: "80%+", min: 80, max: Infinity },
  { id: "secure", label: "60–79%", min: 60, max: 80 },
  { id: "borderline", label: "40–59%", min: 40, max: 60 },
  { id: "low", label: "Below 40%", min: -Infinity, max: 40 },
  { id: "none", label: "Not attempted", min: null, max: null },
] as const);

export type ResultBucketId = (typeof RESULT_BUCKETS)[number]["id"];

export interface DistributionBucket {
  id: string;
  label: string;
  count: number;
}

export const ATTENTION_REASON_LABELS = Object.freeze({
  "assigned-never-attempted": "No activity",
  "repeated-attempts-no-improvement": "Low performance",
  "low-completion": "Completion risk",
  "unresolved-review-backlog": "Awaiting review",
  "repeated-low-topic-or-skill": "Low performance",
  "declining-recent-results": "Low performance",
} as const);

export type AttentionTab = "learner" | "group" | "activity" | "other";

function latestScoreForLearner(rows: readonly LearnerActivityPerformanceRecord[]) {
  const completed = rows
    .filter((row) => row.completedAttemptCount > 0 && row.latestScorePercentage != null)
    .sort((left, right) => (right.latestCompletedAt ?? "").localeCompare(left.latestCompletedAt ?? ""));
  return completed[0]?.latestScorePercentage ?? null;
}

export function latestResultDistribution(
  rows: readonly LearnerActivityPerformanceRecord[],
): readonly DistributionBucket[] {
  const byLearner = new Map<string, LearnerActivityPerformanceRecord[]>();
  for (const row of rows) {
    const current = byLearner.get(row.learnerId) ?? [];
    current.push(row);
    byLearner.set(row.learnerId, current);
  }

  const counts: Record<ResultBucketId, number> = {
    high: 0,
    secure: 0,
    borderline: 0,
    low: 0,
    none: 0,
  };

  for (const learnerRows of byLearner.values()) {
    const score = latestScoreForLearner(learnerRows);
    if (score == null) {
      counts.none += 1;
      continue;
    }
    if (score >= 80) counts.high += 1;
    else if (score >= 60) counts.secure += 1;
    else if (score >= 40) counts.borderline += 1;
    else counts.low += 1;
  }

  return RESULT_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    count: counts[bucket.id],
  }));
}

export function attemptDistribution(
  rows: readonly LearnerActivityPerformanceRecord[],
): readonly DistributionBucket[] {
  const counts = { zero: 0, one: 0, two: 0, three: 0, fourPlus: 0 };
  for (const row of rows) {
    if (row.attemptCount <= 0) counts.zero += 1;
    else if (row.attemptCount === 1) counts.one += 1;
    else if (row.attemptCount === 2) counts.two += 1;
    else if (row.attemptCount === 3) counts.three += 1;
    else counts.fourPlus += 1;
  }
  return [
    { id: "0", label: "Not started", count: counts.zero },
    { id: "1", label: "1 attempt", count: counts.one },
    { id: "2", label: "2 attempts", count: counts.two },
    { id: "3", label: "3 attempts", count: counts.three },
    { id: "4+", label: "4+ attempts", count: counts.fourPlus },
  ];
}

export function latestTimestamp(values: readonly (string | null | undefined)[]) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}

export function groupDerivedMetrics(
  group: GroupPerformanceRecord,
  learnerRows: readonly LearnerActivityPerformanceRecord[],
  activityRows: readonly ActivityAnalyticsRecord[],
) {
  const rows = learnerRows.filter((row) => row.groupCode === group.groupCode);
  const assigned = group.activeLearnerCount;
  const completedLearners = new Set(
    rows.filter((row) => row.completedAttemptCount > 0).map((row) => row.learnerId),
  ).size;
  return {
    completedLearners,
    completionPercentage: assigned
      ? Math.round((1000 * completedLearners) / assigned) / 10
      : null,
    latestResultAverage: group.latestScorePercentage,
    bestResultAverage: group.bestScorePercentage,
    lastActivity: latestTimestamp([
      ...rows.map((row) => row.latestCompletedAt),
      ...activityRows.filter((row) => row.groupCode === group.groupCode).map((row) => row.latestCompletedAt),
    ]),
    awaitingReview: group.requiresReviewCount,
    participatingLearners: group.participatingLearnerCount,
    assignedLearners: assigned,
  };
}

export function attentionReasonLabel(key: string) {
  return ATTENTION_REASON_LABELS[key as keyof typeof ATTENTION_REASON_LABELS] ?? "Needs attention";
}

export function attentionTabForEntity(entityType: string): AttentionTab {
  if (entityType === "learner" || entityType === "group" || entityType === "activity") {
    return entityType;
  }
  return "other";
}

export function attentionEntityLabel(
  signal: { entityType: string; entityKey: string },
  context: {
    learners: readonly { studentNumber: string; displayName: string }[];
    groups: readonly { groupCode: string; groupName: string }[];
    activities: readonly { groupCode: string; activityKey: string; activityTitle?: string | null }[];
  },
) {
  if (signal.entityType === "learner") {
    return context.learners.find((row) => row.studentNumber === signal.entityKey)?.displayName
      ?? signal.entityKey;
  }
  if (signal.entityType === "group") {
    return context.groups.find((row) => row.groupCode === signal.entityKey)?.groupName
      ?? signal.entityKey;
  }
  if (signal.entityType === "activity") {
    const separator = signal.entityKey.indexOf(":");
    const groupCode = separator === -1 ? "" : signal.entityKey.slice(0, separator);
    const activityKey = separator === -1 ? signal.entityKey : signal.entityKey.slice(separator + 1);
    const activity = context.activities.find((row) => row.groupCode === groupCode && row.activityKey === activityKey);
    return activity ? displayLabel(activity.activityTitle, activity.activityKey) : signal.entityKey;
  }
  return signal.entityKey;
}

export function groupAverage(groups: readonly GroupPerformanceRecord[]) {
  const highests = groups
    .map((row) => row.bestScorePercentage)
    .filter((value): value is number => value != null);
  return {
    latest: mean(groups.map((row) => row.latestScorePercentage).filter((value): value is number => value != null)),
    best: mean(highests),
    highest: highests.length ? Math.max(...highests) : null,
    review: groups.reduce((sum, row) => sum + row.requiresReviewCount, 0),
    learners: groups.reduce((sum, row) => sum + row.activeLearnerCount, 0),
  };
}
