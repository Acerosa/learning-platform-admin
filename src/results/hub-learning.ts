export type HubLearningCompletionStatus = "completed" | "in_progress" | "not_started";
export type HubLearningResultSource = "official_attempt" | "formative" | "activity_state" | "none";

export interface HubLearningFilterRow {
  courseKey: string;
  courseTitle: string;
  groupCode: string;
  groupName: string;
  studentNumber: string;
  displayName: string;
  weekNumber: number | null;
  weekTitle: string | null;
  sessionNumber: number | null;
  activityKey: string;
  activityTitle: string;
}

export interface HubLearningResultRow {
  hubCode: string;
  courseKey: string;
  courseTitle: string;
  groupCode: string;
  groupName: string;
  studentNumber: string;
  displayName: string;
  assignmentId: string;
  activityKey: string;
  activityTitle: string;
  activityVersion: string;
  weekNumber: number | null;
  weekTitle: string | null;
  sessionNumber: number | null;
  completionStatus: HubLearningCompletionStatus;
  resultSource: HubLearningResultSource;
  scored: boolean;
  attemptId: string | null;
  attemptStatus: string | null;
  score: number | null;
  maxScore: number | null;
  scorePercentage: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  attemptCount: number;
  formativeCheckCount: number;
  lastActivityAt: string | null;
  completedAt: string | null;
}

export interface HubLearningSummary {
  learnerCount: number;
  activityCount: number;
  rowCount: number;
  startedCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  scoredCompletedCount: number;
  averageScorePercentage: number | null;
  completionPercentage: number | null;
}

export interface HubLearningEvidenceRow {
  source: "attempt" | "formative";
  questionKey: string;
  questionType: string;
  responsePayload: unknown;
  isCorrect: boolean | null;
  awardedScore: number | null;
  maxScore: number | null;
  feedbackSummary: string | null;
  feedbackNextStep: string | null;
  recordedAt: string | null;
}

export interface HubLearningFilters {
  courseKey: string;
  groupCode: string;
  studentNumber: string;
  weekNumber: string;
  sessionNumber: string;
  activityKey: string;
  completionStatus: string;
}

export const EMPTY_HUB_LEARNING_FILTERS: HubLearningFilters = {
  courseKey: "",
  groupCode: "",
  studentNumber: "",
  weekNumber: "",
  sessionNumber: "",
  activityKey: "",
  completionStatus: "",
};

export const EMPTY_HUB_LEARNING_SUMMARY: HubLearningSummary = {
  learnerCount: 0,
  activityCount: 0,
  rowCount: 0,
  startedCount: 0,
  completedCount: 0,
  inProgressCount: 0,
  notStartedCount: 0,
  scoredCompletedCount: 0,
  averageScorePercentage: null,
  completionPercentage: null,
};

function asRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === "object" ? (row as Record<string, unknown>) : {};
}

function stringValue(row: unknown, ...keys: string[]): string {
  const record = asRecord(row);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

function optionalString(row: unknown, ...keys: string[]): string | null {
  const value = stringValue(row, ...keys);
  return value || null;
}

function numberValue(row: unknown, ...keys: string[]): number | null {
  const record = asRecord(row);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function booleanValue(row: unknown, ...keys: string[]): boolean {
  const record = asRecord(row);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

export function mapHubLearningFilterRow(row: unknown): HubLearningFilterRow {
  return {
    courseKey: stringValue(row, "course_key", "courseKey"),
    courseTitle: stringValue(row, "course_title", "courseTitle"),
    groupCode: stringValue(row, "group_code", "groupCode"),
    groupName: stringValue(row, "group_name", "groupName"),
    studentNumber: stringValue(row, "student_number", "studentNumber"),
    displayName: stringValue(row, "display_name", "displayName"),
    weekNumber: numberValue(row, "week_number", "weekNumber"),
    weekTitle: optionalString(row, "week_title", "weekTitle"),
    sessionNumber: numberValue(row, "session_number", "sessionNumber"),
    activityKey: stringValue(row, "activity_key", "activityKey"),
    activityTitle: stringValue(row, "activity_title", "activityTitle"),
  };
}

export function mapHubLearningResultRow(row: unknown): HubLearningResultRow {
  const completion = stringValue(row, "completion_status", "completionStatus");
  const source = stringValue(row, "result_source", "resultSource");
  return {
    hubCode: stringValue(row, "hub_code", "hubCode"),
    courseKey: stringValue(row, "course_key", "courseKey"),
    courseTitle: stringValue(row, "course_title", "courseTitle"),
    groupCode: stringValue(row, "group_code", "groupCode"),
    groupName: stringValue(row, "group_name", "groupName"),
    studentNumber: stringValue(row, "student_number", "studentNumber"),
    displayName: stringValue(row, "display_name", "displayName"),
    assignmentId: stringValue(row, "assignment_id", "assignmentId"),
    activityKey: stringValue(row, "activity_key", "activityKey"),
    activityTitle: stringValue(row, "activity_title", "activityTitle"),
    activityVersion: stringValue(row, "activity_version", "activityVersion"),
    weekNumber: numberValue(row, "week_number", "weekNumber"),
    weekTitle: optionalString(row, "week_title", "weekTitle"),
    sessionNumber: numberValue(row, "session_number", "sessionNumber"),
    completionStatus:
      completion === "completed" || completion === "in_progress"
        ? completion
        : "not_started",
    resultSource:
      source === "official_attempt" || source === "formative" || source === "activity_state"
        ? source
        : "none",
    scored: booleanValue(row, "scored"),
    attemptId: optionalString(row, "attempt_id", "attemptId"),
    attemptStatus: optionalString(row, "attempt_status", "attemptStatus"),
    score: numberValue(row, "score"),
    maxScore: numberValue(row, "max_score", "maxScore"),
    scorePercentage: numberValue(row, "score_percentage", "scorePercentage"),
    correctCount: numberValue(row, "correct_count", "correctCount"),
    incorrectCount: numberValue(row, "incorrect_count", "incorrectCount"),
    attemptCount: numberValue(row, "attempt_count", "attemptCount") ?? 0,
    formativeCheckCount: numberValue(row, "formative_check_count", "formativeCheckCount") ?? 0,
    lastActivityAt: optionalString(row, "last_activity_at", "lastActivityAt"),
    completedAt: optionalString(row, "completed_at", "completedAt"),
  };
}

export function mapHubLearningSummary(row: unknown): HubLearningSummary {
  if (!row) return EMPTY_HUB_LEARNING_SUMMARY;
  return {
    learnerCount: numberValue(row, "learner_count", "learnerCount") ?? 0,
    activityCount: numberValue(row, "activity_count", "activityCount") ?? 0,
    rowCount: numberValue(row, "row_count", "rowCount") ?? 0,
    startedCount: numberValue(row, "started_count", "startedCount") ?? 0,
    completedCount: numberValue(row, "completed_count", "completedCount") ?? 0,
    inProgressCount: numberValue(row, "in_progress_count", "inProgressCount") ?? 0,
    notStartedCount: numberValue(row, "not_started_count", "notStartedCount") ?? 0,
    scoredCompletedCount: numberValue(row, "scored_completed_count", "scoredCompletedCount") ?? 0,
    averageScorePercentage: numberValue(row, "average_score_percentage", "averageScorePercentage"),
    completionPercentage: numberValue(row, "completion_percentage", "completionPercentage"),
  };
}

export function mapHubLearningEvidenceRow(row: unknown): HubLearningEvidenceRow {
  const source = stringValue(row, "source");
  const record = asRecord(row);
  return {
    source: source === "formative" ? "formative" : "attempt",
    questionKey: stringValue(row, "question_key", "questionKey"),
    questionType: stringValue(row, "question_type", "questionType"),
    responsePayload: record.response_payload ?? record.responsePayload ?? null,
    isCorrect: typeof record.is_correct === "boolean"
      ? record.is_correct
      : typeof record.isCorrect === "boolean" ? record.isCorrect : null,
    awardedScore: numberValue(row, "awarded_score", "awardedScore"),
    maxScore: numberValue(row, "max_score", "maxScore"),
    feedbackSummary: optionalString(row, "feedback_summary", "feedbackSummary"),
    feedbackNextStep: optionalString(row, "feedback_next_step", "feedbackNextStep"),
    recordedAt: optionalString(row, "recorded_at", "recordedAt"),
  };
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

export function filterRowsForSelection(
  rows: readonly HubLearningFilterRow[],
  filters: HubLearningFilters,
): HubLearningFilterRow[] {
  return rows.filter((row) => (
    (!filters.courseKey || row.courseKey === filters.courseKey)
    && (!filters.groupCode || row.groupCode === filters.groupCode)
    && (!filters.studentNumber || row.studentNumber === filters.studentNumber)
    && (!filters.weekNumber || String(row.weekNumber ?? "") === filters.weekNumber)
    && (!filters.sessionNumber || String(row.sessionNumber ?? "") === filters.sessionNumber)
    && (!filters.activityKey || row.activityKey === filters.activityKey)
  ));
}

export function cascadeHubLearningFilters(
  rows: readonly HubLearningFilterRow[],
  filters: HubLearningFilters,
): HubLearningFilters {
  const next = { ...filters };
  const afterCourse = rows.filter((row) => !next.courseKey || row.courseKey === next.courseKey);
  if (next.groupCode && !afterCourse.some((row) => row.groupCode === next.groupCode)) {
    next.groupCode = "";
    next.studentNumber = "";
  }
  const afterGroup = afterCourse.filter((row) => !next.groupCode || row.groupCode === next.groupCode);
  if (next.studentNumber && !afterGroup.some((row) => row.studentNumber === next.studentNumber)) {
    next.studentNumber = "";
  }
  const afterLearner = afterGroup.filter((row) => !next.studentNumber || row.studentNumber === next.studentNumber);
  if (next.weekNumber && !afterLearner.some((row) => String(row.weekNumber ?? "") === next.weekNumber)) {
    next.weekNumber = "";
    next.sessionNumber = "";
  }
  const afterWeek = afterLearner.filter((row) => !next.weekNumber || String(row.weekNumber ?? "") === next.weekNumber);
  if (next.sessionNumber && !afterWeek.some((row) => String(row.sessionNumber ?? "") === next.sessionNumber)) {
    next.sessionNumber = "";
  }
  const afterSession = afterWeek.filter((row) => !next.sessionNumber || String(row.sessionNumber ?? "") === next.sessionNumber);
  if (next.activityKey && !afterSession.some((row) => row.activityKey === next.activityKey)) {
    next.activityKey = "";
  }
  return next;
}

export function uniqueCourses(rows: readonly HubLearningFilterRow[]) {
  return uniqueBy(rows, (row) => row.courseKey).map((row) => ({
    value: row.courseKey,
    label: row.courseTitle,
  }));
}

export function uniqueGroups(rows: readonly HubLearningFilterRow[], courseKey: string) {
  return uniqueBy(
    rows.filter((row) => !courseKey || row.courseKey === courseKey),
    (row) => row.groupCode,
  ).map((row) => ({ value: row.groupCode, label: `${row.groupName} (${row.groupCode})` }));
}

export function uniqueLearners(rows: readonly HubLearningFilterRow[], filters: HubLearningFilters) {
  return uniqueBy(
    filterRowsForSelection(rows, { ...filters, studentNumber: "", weekNumber: "", sessionNumber: "", activityKey: "", completionStatus: "" }),
    (row) => row.studentNumber,
  ).map((row) => ({ value: row.studentNumber, label: `${row.displayName} (${row.studentNumber})` }));
}

export function uniqueWeeks(rows: readonly HubLearningFilterRow[], filters: HubLearningFilters) {
  return uniqueBy(
    filterRowsForSelection(rows, { ...filters, weekNumber: "", sessionNumber: "", activityKey: "", completionStatus: "" })
      .filter((row) => row.weekNumber != null),
    (row) => String(row.weekNumber),
  ).map((row) => ({
    value: String(row.weekNumber),
    label: row.weekTitle ? `Week ${row.weekNumber} — ${row.weekTitle}` : `Week ${row.weekNumber}`,
  }));
}

export function uniqueSessions(rows: readonly HubLearningFilterRow[], filters: HubLearningFilters) {
  return uniqueBy(
    filterRowsForSelection(rows, { ...filters, sessionNumber: "", activityKey: "", completionStatus: "" })
      .filter((row) => row.sessionNumber != null),
    (row) => String(row.sessionNumber),
  ).map((row) => ({
    value: String(row.sessionNumber),
    label: `Session ${row.sessionNumber}`,
  }));
}

export function uniqueActivities(rows: readonly HubLearningFilterRow[], filters: HubLearningFilters) {
  return uniqueBy(
    filterRowsForSelection(rows, { ...filters, activityKey: "", completionStatus: "" }),
    (row) => row.activityKey,
  ).map((row) => ({ value: row.activityKey, label: row.activityTitle }));
}

export function hubLearningRpcParams(hubCode: string, filters: HubLearningFilters) {
  return {
    p_hub_code: hubCode,
    p_course_key: filters.courseKey || null,
    p_group_code: filters.groupCode || null,
    p_student_number: filters.studentNumber || null,
    p_week_number: filters.weekNumber ? Number(filters.weekNumber) : null,
    p_session_number: filters.sessionNumber ? Number(filters.sessionNumber) : null,
    p_activity_key: filters.activityKey || null,
    p_completion_status: filters.completionStatus || null,
  };
}

export function completionLabel(row: Pick<HubLearningResultRow, "completionStatus" | "resultSource">): string {
  if (row.completionStatus === "completed") return "Completed";
  if (row.completionStatus === "not_started") return "Not started";
  if (row.resultSource === "formative") return "In progress";
  if (row.resultSource === "activity_state") return "In progress";
  return "In progress";
}

export function sourceLabel(source: HubLearningResultSource): string {
  if (source === "official_attempt") return "Official attempt";
  if (source === "formative") return "Practice check";
  if (source === "activity_state") return "Saved progress";
  return "Not started";
}

export function scoreLabel(row: Pick<HubLearningResultRow, "scored" | "score" | "maxScore">): string {
  if (!row.scored || row.score == null || row.maxScore == null) return "—";
  return `${row.score} / ${row.maxScore}`;
}

export function percentageLabel(value: number | null | undefined): string {
  return value == null ? "—" : `${Number(value).toFixed(0)}%`;
}

export function countsLabel(row: Pick<HubLearningResultRow, "scored" | "correctCount" | "incorrectCount">): string {
  if (!row.scored || row.correctCount == null || row.incorrectCount == null) return "—";
  return `${row.correctCount} / ${row.incorrectCount}`;
}

export const DEMO_HUB_LEARNING_FILTERS: HubLearningFilterRow[] = [
  {
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    groupCode: "CYBER-DEMO",
    groupName: "Demo Cyber Group",
    studentNumber: "DEMO-1001",
    displayName: "Alex Demo",
    weekNumber: 1,
    weekTitle: "Week 1",
    sessionNumber: 1,
    activityKey: "demo-scored-quiz",
    activityTitle: "Threats quiz",
  },
  {
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    groupCode: "CYBER-DEMO",
    groupName: "Demo Cyber Group",
    studentNumber: "DEMO-1002",
    displayName: "Jordan Demo",
    weekNumber: 1,
    weekTitle: "Week 1",
    sessionNumber: 1,
    activityKey: "demo-scored-quiz",
    activityTitle: "Threats quiz",
  },
  {
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    groupCode: "CYBER-DEMO",
    groupName: "Demo Cyber Group",
    studentNumber: "DEMO-1002",
    displayName: "Jordan Demo",
    weekNumber: 2,
    weekTitle: "Week 2",
    sessionNumber: 1,
    activityKey: "demo-written-task",
    activityTitle: "Incident reflection",
  },
];

export const DEMO_HUB_LEARNING_RESULTS: HubLearningResultRow[] = [
  {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    groupCode: "CYBER-DEMO",
    groupName: "Demo Cyber Group",
    studentNumber: "DEMO-1001",
    displayName: "Alex Demo",
    assignmentId: "demo-assignment-scored",
    activityKey: "demo-scored-quiz",
    activityTitle: "Threats quiz",
    activityVersion: "1.1.0",
    weekNumber: 1,
    weekTitle: "Week 1",
    sessionNumber: 1,
    completionStatus: "completed",
    resultSource: "official_attempt",
    scored: true,
    attemptId: "demo-attempt-1",
    attemptStatus: "completed",
    score: 8,
    maxScore: 10,
    scorePercentage: 80,
    correctCount: 4,
    incorrectCount: 1,
    attemptCount: 1,
    formativeCheckCount: 0,
    lastActivityAt: "2026-09-03T12:05:00.000Z",
    completedAt: "2026-09-03T12:05:00.000Z",
  },
  {
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    courseTitle: "OCR Level 3 IT",
    groupCode: "CYBER-DEMO",
    groupName: "Demo Cyber Group",
    studentNumber: "DEMO-1002",
    displayName: "Jordan Demo",
    assignmentId: "demo-assignment-written",
    activityKey: "demo-written-task",
    activityTitle: "Incident reflection",
    activityVersion: "1.0.0",
    weekNumber: 2,
    weekTitle: "Week 2",
    sessionNumber: 1,
    completionStatus: "in_progress",
    resultSource: "activity_state",
    scored: false,
    attemptId: null,
    attemptStatus: null,
    score: null,
    maxScore: null,
    scorePercentage: null,
    correctCount: null,
    incorrectCount: null,
    attemptCount: 0,
    formativeCheckCount: 0,
    lastActivityAt: "2026-09-04T09:12:00.000Z",
    completedAt: null,
  },
];

export const DEMO_HUB_LEARNING_SUMMARY: HubLearningSummary = {
  learnerCount: 2,
  activityCount: 2,
  rowCount: 2,
  startedCount: 2,
  completedCount: 1,
  inProgressCount: 1,
  notStartedCount: 0,
  scoredCompletedCount: 1,
  averageScorePercentage: 80,
  completionPercentage: 50,
};

export const DEMO_HUB_LEARNING_EVIDENCE: HubLearningEvidenceRow[] = [
  {
    source: "attempt",
    questionKey: "Q1",
    questionType: "single",
    responsePayload: { selected: "A" },
    isCorrect: true,
    awardedScore: 8,
    maxScore: 10,
    feedbackSummary: "Accurate identification of the threat family.",
    feedbackNextStep: "Apply the same test to the remaining examples.",
    recordedAt: "2026-09-03T12:05:00.000Z",
  },
];
