import type {
  ActivityAnalyticsRecord,
  AdminDataSnapshot,
  GroupPerformanceRecord,
  HubRecord,
  LearnerActivityPerformanceRecord,
  QuestionGroupPerformanceRecord,
  QuestionPerformanceRecord,
} from "../api/admin-api.ts";
import { activityStatus, displayLabel, mean } from "./metrics.ts";

export const ALL_SCOPE = "all";

export type AnalyticsPane =
  | "overview"
  | "groups"
  | "learners"
  | "activities"
  | "questions"
  | "topics-skills"
  | "readiness"
  | "attention";

export interface AnalyticsScope {
  hubCode: string;
  courseKey: string;
  groupCode: string;
  activityKey: string;
  topicKey: string;
  skillKey: string;
}

export const EMPTY_SCOPE: AnalyticsScope = Object.freeze({
  hubCode: ALL_SCOPE,
  courseKey: ALL_SCOPE,
  groupCode: ALL_SCOPE,
  activityKey: ALL_SCOPE,
  topicKey: ALL_SCOPE,
  skillKey: ALL_SCOPE,
});

export const PANE_FILTERS: Record<AnalyticsPane, ReadonlySet<keyof AnalyticsScope>> = {
  overview: new Set(["hubCode", "courseKey", "groupCode", "activityKey"]),
  groups: new Set(["hubCode", "courseKey", "groupCode"]),
  learners: new Set(["hubCode", "courseKey", "groupCode", "activityKey"]),
  activities: new Set(["hubCode", "courseKey", "groupCode", "activityKey"]),
  questions: new Set(["hubCode", "courseKey", "groupCode", "activityKey", "topicKey", "skillKey"]),
  "topics-skills": new Set(["topicKey", "skillKey"]),
  readiness: new Set(["hubCode", "courseKey", "groupCode", "activityKey"]),
  attention: new Set(["hubCode", "courseKey", "groupCode", "activityKey"]),
};

export interface FilterOption {
  value: string;
  label: string;
}

export interface LearnerSummaryRow {
  learnerId: string;
  studentNumber: string;
  displayName: string;
  groupCode: string;
  groupName: string;
  courseKey: string;
  courseTitle: string;
  assignedCount: number;
  completedCount: number;
  completionPercentage: number | null;
  latestActivityTitle: string | null;
  latestActivityKey: string | null;
  latestResultPercentage: number | null;
  latestResultAveragePercentage: number | null;
  attemptAveragePercentage: number | null;
  requiresReviewCount: number;
  rows: readonly LearnerActivityPerformanceRecord[];
}

export interface ScopedOverview {
  assignedLearners: number;
  participatingLearners: number;
  completedLearners: number;
  completionPercentage: number | null;
  participationPercentage: number | null;
  latestResultAverage: number | null;
  bestResultAverage: number | null;
  attemptCount: number;
  awaitingReview: number;
}

export function isAllScope(value: string) {
  return value === ALL_SCOPE || !value;
}

function isAll(value: string) {
  return isAllScope(value);
}

export function courseKeysForHub(data: AdminDataSnapshot, hubCode: string) {
  if (isAll(hubCode)) {
    return new Set(data.hubCourseLinks.map((link) => link.courseKey));
  }
  return new Set(
    data.hubCourseLinks
      .filter((link) => link.hubCode === hubCode && link.active)
      .map((link) => link.courseKey),
  );
}

export function hubMatchesCourse(
  data: AdminDataSnapshot,
  hubCode: string,
  courseKey: string,
  hubCodes: readonly string[] = [],
) {
  if (isAll(hubCode)) return true;
  if (hubCodes.includes(hubCode)) return true;
  return courseKeysForHub(data, hubCode).has(courseKey);
}

export function constrainScope(scope: AnalyticsScope, data: AdminDataSnapshot): AnalyticsScope {
  const courseKeys = courseKeysForHub(data, scope.hubCode);
  const courseKey = !isAll(scope.courseKey) && (isAll(scope.hubCode) || courseKeys.has(scope.courseKey))
    ? scope.courseKey
    : ALL_SCOPE;

  const groups = data.groupPerformance.filter((row) => isAll(courseKey) || row.courseKey === courseKey);
  const groupCode = !isAll(scope.groupCode) && groups.some((row) => row.groupCode === scope.groupCode)
    ? scope.groupCode
    : ALL_SCOPE;

  const activities = data.activityAnalytics.filter((row) =>
    (isAll(courseKey) || row.courseKey === courseKey)
    && (isAll(groupCode) || row.groupCode === groupCode)
    && hubMatchesCourse(data, scope.hubCode, row.courseKey),
  );
  const activityKey = !isAll(scope.activityKey) && activities.some((row) => row.activityKey === scope.activityKey)
    ? scope.activityKey
    : ALL_SCOPE;

  return {
    ...scope,
    courseKey,
    groupCode,
    activityKey,
  };
}

export function matchesHierarchy(
  data: AdminDataSnapshot,
  scope: AnalyticsScope,
  row: {
    courseKey: string;
    groupCode?: string;
    activityKey?: string;
    hubCodes?: readonly string[];
  },
) {
  if (!hubMatchesCourse(data, scope.hubCode, row.courseKey, row.hubCodes)) return false;
  if (!isAll(scope.courseKey) && row.courseKey !== scope.courseKey) return false;
  if (row.groupCode != null && !isAll(scope.groupCode) && row.groupCode !== scope.groupCode) return false;
  if (row.activityKey != null && !isAll(scope.activityKey) && row.activityKey !== scope.activityKey) return false;
  return true;
}

export function scopedLearnerActivity(
  data: AdminDataSnapshot,
  scope: AnalyticsScope,
): readonly LearnerActivityPerformanceRecord[] {
  return data.learnerActivityPerformance.filter((row) => matchesHierarchy(data, scope, row));
}

export function scopedGroups(
  data: AdminDataSnapshot,
  scope: AnalyticsScope,
): readonly GroupPerformanceRecord[] {
  return data.groupPerformance.filter((row) => matchesHierarchy(data, scope, {
    courseKey: row.courseKey,
    groupCode: row.groupCode,
  }));
}

export function scopedActivities(
  data: AdminDataSnapshot,
  scope: AnalyticsScope,
): readonly ActivityAnalyticsRecord[] {
  return data.activityAnalytics.filter((row) => matchesHierarchy(data, scope, row));
}

export function scopedPlatformQuestions(
  data: AdminDataSnapshot,
  scope: AnalyticsScope,
): readonly QuestionPerformanceRecord[] {
  return data.questionPerformance.filter((row) => {
    if (!isAll(scope.activityKey) && row.activityKey !== scope.activityKey) return false;
    if (!isAll(scope.topicKey) && !row.topicKeys.includes(scope.topicKey)) return false;
    if (!isAll(scope.skillKey) && !row.skillKeys.includes(scope.skillKey)) return false;
    if (!isAll(scope.hubCode) || !isAll(scope.courseKey) || !isAll(scope.groupCode)) return false;
    return true;
  });
}

export function scopedGroupQuestions(
  data: AdminDataSnapshot,
  scope: AnalyticsScope,
): readonly QuestionGroupPerformanceRecord[] {
  return data.questionGroupPerformance.filter((row) => {
    if (!matchesHierarchy(data, scope, row)) return false;
    if (!isAll(scope.topicKey) && !row.topicKeys.includes(scope.topicKey)) return false;
    if (!isAll(scope.skillKey) && !row.skillKeys.includes(scope.skillKey)) return false;
    return true;
  });
}

export function questionsAreGroupScoped(scope: AnalyticsScope) {
  return !isAll(scope.groupCode) || !isAll(scope.courseKey) || !isAll(scope.hubCode);
}

export function topicSkillFiltersOnly(scope: AnalyticsScope) {
  return isAll(scope.hubCode) && isAll(scope.courseKey) && isAll(scope.groupCode) && isAll(scope.activityKey);
}

export function attentionSignalInScope(
  signal: { entityType: string; entityKey: string },
  scope: AnalyticsScope,
  context: {
    learnerNumbers: readonly string[];
    groupCodes: readonly string[];
    activities: readonly { groupCode: string; activityKey: string }[];
  },
) {
  if (signal.entityType === "group") {
    return context.groupCodes.includes(signal.entityKey);
  }
  if (signal.entityType === "activity") {
    const separator = signal.entityKey.indexOf(":");
    const groupCode = separator === -1 ? "" : signal.entityKey.slice(0, separator);
    const activityKey = separator === -1 ? signal.entityKey : signal.entityKey.slice(separator + 1);
    return context.activities.some((row) => row.groupCode === groupCode && row.activityKey === activityKey);
  }
  if (signal.entityType === "learner") {
    return context.learnerNumbers.includes(signal.entityKey);
  }
  if (signal.entityType === "topic" || signal.entityType === "skill") {
    if (!topicSkillFiltersOnly(scope)) return false;
    if (!isAll(scope.topicKey) && signal.entityType === "topic") return signal.entityKey === scope.topicKey;
    if (!isAll(scope.skillKey) && signal.entityType === "skill") return signal.entityKey === scope.skillKey;
    return true;
  }
  return topicSkillFiltersOnly(scope);
}

export function scopedOverview(data: AdminDataSnapshot, scope: AnalyticsScope): ScopedOverview {
  const rows = scopedLearnerActivity(data, scope);
  const assignedIds = new Set(rows.map((row) => row.learnerId));
  const participatingIds = new Set(rows.filter((row) => row.attemptCount > 0).map((row) => row.learnerId));
  const completedIds = new Set(rows.filter((row) => row.completedAttemptCount > 0).map((row) => row.learnerId));
  const assignedLearners = assignedIds.size;
  const participatingLearners = participatingIds.size;
  const completedLearners = completedIds.size;
  return {
    assignedLearners,
    participatingLearners,
    completedLearners,
    completionPercentage: assignedLearners
      ? Math.round((1000 * completedLearners) / assignedLearners) / 10
      : null,
    participationPercentage: assignedLearners
      ? Math.round((1000 * participatingLearners) / assignedLearners) / 10
      : null,
    latestResultAverage: mean(
      rows
        .map((row) => row.latestScorePercentage)
        .filter((value): value is number => value != null),
    ),
    bestResultAverage: mean(
      rows
        .map((row) => row.bestScorePercentage)
        .filter((value): value is number => value != null),
    ),
    attemptCount: rows.reduce((sum, row) => sum + row.attemptCount, 0),
    awaitingReview: rows.reduce((sum, row) => sum + row.requiresReviewCount, 0),
  };
}

export function learnerSummaries(
  data: AdminDataSnapshot,
  scope: AnalyticsScope,
): readonly LearnerSummaryRow[] {
  const grouped = new Map<string, LearnerActivityPerformanceRecord[]>();
  for (const row of scopedLearnerActivity(data, scope)) {
    const current = grouped.get(row.learnerId) ?? [];
    current.push(row);
    grouped.set(row.learnerId, current);
  }

  return [...grouped.values()]
    .map((rows) => {
      const latest = [...rows].sort((left, right) => {
        const leftDate = left.latestCompletedAt ?? "";
        const rightDate = right.latestCompletedAt ?? "";
        return rightDate.localeCompare(leftDate);
      })[0];
      const completedCount = rows.filter((row) => row.completedAttemptCount > 0).length;
      const groups = [...new Set(rows.map((row) => row.groupCode))];
      const courses = [...new Set(rows.map((row) => row.courseKey))];
      const latestCompleted = rows.find((row) => row.latestCompletedAt === latest?.latestCompletedAt && row.latestScorePercentage != null)
        ?? rows.find((row) => row.latestScorePercentage != null)
        ?? latest;
      return {
        learnerId: rows[0].learnerId,
        studentNumber: rows[0].studentNumber,
        displayName: rows[0].displayName,
        groupCode: groups.length === 1 ? rows[0].groupCode : groups.join(", "),
        groupName: groups.length === 1 ? rows[0].groupName : groups.map((code) => rows.find((row) => row.groupCode === code)?.groupName ?? code).join(", "),
        courseKey: courses.length === 1 ? rows[0].courseKey : courses.join(", "),
        courseTitle: courses.length === 1 ? rows[0].courseTitle : courses.map((key) => rows.find((row) => row.courseKey === key)?.courseTitle ?? key).join(", "),
        assignedCount: rows.length,
        completedCount,
        completionPercentage: rows.length
          ? Math.round((1000 * completedCount) / rows.length) / 10
          : null,
        latestActivityTitle: latestCompleted?.activityTitle ?? null,
        latestActivityKey: latestCompleted?.activityKey ?? null,
        latestResultPercentage: latestCompleted?.latestScorePercentage ?? null,
        latestResultAveragePercentage: mean(
          rows
            .map((row) => row.latestScorePercentage)
            .filter((value): value is number => value != null),
        ),
        attemptAveragePercentage: mean(
          rows
            .map((row) => row.averageScorePercentage)
            .filter((value): value is number => value != null),
        ),
        requiresReviewCount: rows.reduce((sum, row) => sum + row.requiresReviewCount, 0),
        rows,
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function hubOptions(data: AdminDataSnapshot): FilterOption[] {
  return [...data.hubs]
    .filter((hub) => hub.active)
    .sort((left, right) => left.hubName.localeCompare(right.hubName))
    .map((hub) => ({ value: hub.hubCode, label: hub.hubName }));
}

export function courseOptions(data: AdminDataSnapshot, scope: AnalyticsScope): FilterOption[] {
  const allowed = courseKeysForHub(data, scope.hubCode);
  const titles = new Map(data.courses.map((course) => [course.courseKey, course.courseTitle]));
  for (const row of data.groupPerformance) titles.set(row.courseKey, row.courseTitle || row.courseKey);
  for (const row of data.activityAnalytics) titles.set(row.courseKey, row.courseTitle || row.courseKey);
  const keys = [...new Set([
    ...data.courses.map((course) => course.courseKey),
    ...data.groupPerformance.map((row) => row.courseKey),
    ...data.activityAnalytics.map((row) => row.courseKey),
    ...data.learnerActivityPerformance.map((row) => row.courseKey),
  ])].filter((key) => isAll(scope.hubCode) || allowed.has(key));
  return keys
    .sort()
    .map((key) => ({ value: key, label: displayLabel(titles.get(key), key) }));
}

export function groupOptions(data: AdminDataSnapshot, scope: AnalyticsScope): FilterOption[] {
  return scopedGroups(data, { ...scope, groupCode: ALL_SCOPE })
    .map((row) => ({ value: row.groupCode, label: `${row.groupName} (${row.groupCode})` }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function activityOptions(data: AdminDataSnapshot, scope: AnalyticsScope): FilterOption[] {
  const unique = new Map<string, FilterOption>();
  for (const row of scopedActivities(data, { ...scope, activityKey: ALL_SCOPE })) {
    unique.set(row.activityKey, {
      value: row.activityKey,
      label: displayLabel(row.activityTitle, row.activityKey),
    });
  }
  for (const row of scopedLearnerActivity(data, { ...scope, activityKey: ALL_SCOPE })) {
    unique.set(row.activityKey, {
      value: row.activityKey,
      label: displayLabel(row.activityTitle, row.activityKey),
    });
  }
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export function topicOptions(data: AdminDataSnapshot): FilterOption[] {
  return [...new Set(data.topicPerformance.map((row) => row.topicKey))]
    .sort()
    .map((value) => ({ value, label: value }));
}

export function skillOptions(data: AdminDataSnapshot): FilterOption[] {
  return [...new Set(data.skillPerformance.map((row) => row.skillKey))]
    .sort()
    .map((value) => ({ value, label: value }));
}

export function hubTitle(data: AdminDataSnapshot, hubCode: string) {
  if (isAll(hubCode)) return "All hubs";
  return data.hubs.find((hub: HubRecord) => hub.hubCode === hubCode)?.hubName ?? hubCode;
}

export function courseTitle(data: AdminDataSnapshot, courseKey: string) {
  if (isAll(courseKey)) return "All courses";
  return data.courses.find((course) => course.courseKey === courseKey)?.courseTitle
    ?? data.groupPerformance.find((row) => row.courseKey === courseKey)?.courseTitle
    ?? data.learnerActivityPerformance.find((row) => row.courseKey === courseKey)?.courseTitle
    ?? courseKey;
}

export function groupTitle(data: AdminDataSnapshot, groupCode: string) {
  if (isAll(groupCode)) return "All groups";
  return data.groups.find((group) => group.groupCode === groupCode)?.groupName
    ?? data.groupPerformance.find((row) => row.groupCode === groupCode)?.groupName
    ?? groupCode;
}

export function activityTitle(data: AdminDataSnapshot, activityKey: string) {
  if (isAll(activityKey)) return "All activities";
  return data.activityAnalytics.find((row) => row.activityKey === activityKey)?.activityTitle
    ?? data.learnerActivityPerformance.find((row) => row.activityKey === activityKey)?.activityTitle
    ?? activityKey;
}

export function scopeTrail(data: AdminDataSnapshot, scope: AnalyticsScope) {
  return [
    hubTitle(data, scope.hubCode),
    courseTitle(data, scope.courseKey),
    groupTitle(data, scope.groupCode),
    activityTitle(data, scope.activityKey),
    "All learners",
  ];
}

export function activityRowKey(row: Pick<ActivityAnalyticsRecord, "groupCode" | "activityKey" | "activityVersion" | "assignmentId">) {
  return row.assignmentId || `${row.groupCode}:${row.activityKey}:${row.activityVersion}`;
}

export function learnerActivityStatus(row: LearnerActivityPerformanceRecord) {
  return activityStatus(row.attemptCount, row.completedAttemptCount);
}

export const SCOPE_SEARCH_KEYS = [
  "hub",
  "course",
  "group",
  "activity",
  "topic",
  "skill",
  "pane",
  "learner",
  "assignment",
] as const;

export function scopeFromSearch(search: string): Partial<AnalyticsScope> & {
  pane?: AnalyticsPane;
  learnerId?: string;
  assignmentId?: string;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const pane = params.get("pane");
  return {
    hubCode: params.get("hub") || undefined,
    courseKey: params.get("course") || undefined,
    groupCode: params.get("group") || undefined,
    activityKey: params.get("activity") || undefined,
    topicKey: params.get("topic") || undefined,
    skillKey: params.get("skill") || undefined,
    pane: pane && pane in PANE_FILTERS ? pane as AnalyticsPane : undefined,
    learnerId: params.get("learner") || undefined,
    assignmentId: params.get("assignment") || undefined,
  };
}

export function searchFromAnalyticsState(input: {
  scope: AnalyticsScope;
  pane: AnalyticsPane;
  learnerId: string | null;
  assignmentId: string | null;
}) {
  const params = new URLSearchParams();
  if (input.pane !== "overview") params.set("pane", input.pane);
  if (!isAll(input.scope.hubCode)) params.set("hub", input.scope.hubCode);
  if (!isAll(input.scope.courseKey)) params.set("course", input.scope.courseKey);
  if (!isAll(input.scope.groupCode)) params.set("group", input.scope.groupCode);
  if (!isAll(input.scope.activityKey)) params.set("activity", input.scope.activityKey);
  if (!isAll(input.scope.topicKey)) params.set("topic", input.scope.topicKey);
  if (!isAll(input.scope.skillKey)) params.set("skill", input.scope.skillKey);
  if (input.learnerId) params.set("learner", input.learnerId);
  if (input.assignmentId) params.set("assignment", input.assignmentId);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}
