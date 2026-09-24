export type KnowledgeReportStatus =
  | "not_started"
  | "in_progress"
  | "time_elapsed"
  | "submitted"
  | "reviewed";

export interface KnowledgeReportFilters {
  courseKey: string;
  groupCode: string;
  studentNumber: string;
  activityKey: string;
  completionStatus: string;
  minimumMet: string;
  reviewStatus: string;
  relevance: string;
}

export interface KnowledgeReportRow {
  studentId: string;
  studentNumber: string;
  learnerName: string;
  groupId: string;
  groupCode: string;
  groupName: string;
  courseKey: string;
  activityId: string;
  activityKey: string;
  activityVersionId: string;
  reportTitle: string;
  assignmentId: string;
  completionStatus: KnowledgeReportStatus;
  startedAt: string | null;
  durationSeconds: number | null;
  wordCount: number | null;
  minimumWords: number | null;
  minimumMet: boolean | null;
  elapsedSeconds: number | null;
  submissionMethod: string | null;
  requiresReview: boolean | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  responseId: string | null;
  overallRelevance: string | null;
  repetitionFlag: boolean | null;
}

export const EMPTY_KNOWLEDGE_REPORT_FILTERS: KnowledgeReportFilters = {
  courseKey: "",
  groupCode: "",
  studentNumber: "",
  activityKey: "",
  completionStatus: "",
  minimumMet: "",
  reviewStatus: "",
  relevance: "",
};

const STATUSES = new Set<KnowledgeReportStatus>([
  "not_started",
  "in_progress",
  "time_elapsed",
  "submitted",
  "reviewed",
]);

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function nullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function recordOf(row: unknown): Record<string, unknown> {
  return row && typeof row === "object" ? row as Record<string, unknown> : {};
}

export function mapKnowledgeReportRow(row: unknown): KnowledgeReportRow {
  const record = recordOf(row);
  const status = text(record.completion_status ?? record.completionStatus);
  return {
    studentId: text(record.student_id ?? record.studentId),
    studentNumber: text(record.student_number ?? record.studentNumber),
    learnerName: text(record.learner_name ?? record.learnerName),
    groupId: text(record.group_id ?? record.groupId),
    groupCode: text(record.group_code ?? record.groupCode),
    groupName: text(record.group_name ?? record.groupName),
    courseKey: text(record.course_key ?? record.courseKey),
    activityId: text(record.activity_id ?? record.activityId),
    activityKey: text(record.activity_key ?? record.activityKey),
    activityVersionId: text(record.activity_version_id ?? record.activityVersionId),
    reportTitle: text(record.report_title ?? record.reportTitle),
    assignmentId: text(record.assignment_id ?? record.assignmentId),
    completionStatus: STATUSES.has(status as KnowledgeReportStatus) ? status as KnowledgeReportStatus : "not_started",
    startedAt: nullableText(record.started_at ?? record.startedAt),
    durationSeconds: nullableNumber(record.duration_seconds ?? record.durationSeconds),
    wordCount: nullableNumber(record.word_count ?? record.wordCount),
    minimumWords: nullableNumber(record.minimum_words ?? record.minimumWords),
    minimumMet: nullableBoolean(record.minimum_met ?? record.minimumMet),
    elapsedSeconds: nullableNumber(record.elapsed_seconds ?? record.elapsedSeconds),
    submissionMethod: nullableText(record.submission_method ?? record.submissionMethod),
    requiresReview: nullableBoolean(record.requires_review ?? record.requiresReview),
    submittedAt: nullableText(record.submitted_at ?? record.submittedAt),
    reviewedAt: nullableText(record.reviewed_at ?? record.reviewedAt),
    responseId: nullableText(record.response_id ?? record.responseId),
    overallRelevance: nullableText(record.overall_relevance ?? record.overallRelevance),
    repetitionFlag: nullableBoolean(record.repetition_flag ?? record.repetitionFlag),
  };
}

export function knowledgeReportRpcParams(hubCode: string, filters: KnowledgeReportFilters): Record<string, unknown> {
  return {
    p_hub_code: hubCode,
    p_course_key: filters.courseKey || null,
    p_group_code: filters.groupCode || null,
    p_student_number: filters.studentNumber || null,
    p_activity_key: filters.activityKey || null,
    p_completion_status: filters.completionStatus || null,
    p_minimum_met: filters.minimumMet || null,
    p_review_status: filters.reviewStatus || null,
    p_relevance: filters.relevance || null,
  };
}

export function cascadeKnowledgeReportFilters(
  rows: readonly KnowledgeReportRow[],
  filters: KnowledgeReportFilters,
): KnowledgeReportFilters {
  const courseRows = filters.courseKey ? rows.filter((row) => row.courseKey === filters.courseKey) : rows;
  const groupOk = !filters.groupCode || courseRows.some((row) => row.groupCode === filters.groupCode);
  const groupRows = groupOk ? courseRows.filter((row) => !filters.groupCode || row.groupCode === filters.groupCode) : courseRows;
  const learnerOk = !filters.studentNumber || groupRows.some((row) => row.studentNumber === filters.studentNumber);
  const learnerRows = learnerOk
    ? groupRows.filter((row) => !filters.studentNumber || row.studentNumber === filters.studentNumber)
    : groupRows;
  const reportOk = !filters.activityKey || learnerRows.some((row) => row.activityKey === filters.activityKey);
  return {
    courseKey: filters.courseKey,
    groupCode: groupOk ? filters.groupCode : "",
    studentNumber: learnerOk ? filters.studentNumber : "",
    activityKey: reportOk ? filters.activityKey : "",
    completionStatus: filters.completionStatus,
    minimumMet: filters.minimumMet,
    reviewStatus: filters.reviewStatus,
    relevance: filters.relevance,
  };
}

export function filterKnowledgeReports(
  rows: readonly KnowledgeReportRow[],
  filters: KnowledgeReportFilters,
): KnowledgeReportRow[] {
  const cascaded = cascadeKnowledgeReportFilters(rows, filters);
  return rows.filter((row) => (
    (!cascaded.courseKey || row.courseKey === cascaded.courseKey)
    && (!cascaded.groupCode || row.groupCode === cascaded.groupCode)
    && (!cascaded.studentNumber || row.studentNumber === cascaded.studentNumber)
    && (!cascaded.activityKey || row.activityKey === cascaded.activityKey)
    && (!cascaded.completionStatus || row.completionStatus === cascaded.completionStatus)
    && (cascaded.minimumMet !== "met" || row.minimumMet === true)
    && (cascaded.minimumMet !== "not_reached" || row.minimumMet === false)
    && (cascaded.reviewStatus !== "needs_review" || row.requiresReview === true)
    && (cascaded.reviewStatus !== "reviewed" || row.completionStatus === "reviewed")
    && (!cascaded.relevance || row.overallRelevance === cascaded.relevance)
  ));
}

export function uniqueOptions(
  rows: readonly KnowledgeReportRow[],
  key: "courseKey" | "groupCode" | "studentNumber" | "activityKey",
  label: (row: KnowledgeReportRow) => string,
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const value = row[key];
    if (value && !seen.has(value)) seen.set(value, label(row));
  }
  return [...seen.entries()].map(([value, optionLabel]) => ({ value, label: optionLabel }));
}

export function statusLabel(status: KnowledgeReportStatus): string {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  if (status === "time_elapsed") return "Time elapsed - awaiting finalisation";
  if (status === "submitted") return "Submitted";
  return "Reviewed";
}

export function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function minimumLabel(met: boolean | null | undefined): string {
  if (met === true) return "Met";
  if (met === false) return "Not reached";
  return "—";
}

export function minimumEvidenceLabel(met: boolean | null | undefined, words: number | null | undefined): string {
  if (met == null || words == null) return "—";
  return `${met ? "Met" : "Not reached"} · ${words} words`;
}

export function submissionMethodLabel(method: string | null | undefined): string {
  if (method === "manual") return "Manual";
  if (method === "timer_expired") return "Time expired";
  if (!method) return "—";
  return method;
}

export function reviewLabel(row: Pick<KnowledgeReportRow, "completionStatus" | "requiresReview" | "overallRelevance">): string {
  if (row.completionStatus === "reviewed" || row.requiresReview === false) return "Reviewed";
  if (row.requiresReview === true && row.overallRelevance === "very_low") return "Check response";
  if (row.requiresReview === true) return "Needs review";
  return "—";
}

export function relevanceLabel(value: string | null | undefined): string {
  if (value === "high") return "High relevance";
  if (value === "moderate") return "Moderate relevance";
  if (value === "low") return "Low relevance";
  if (value === "very_low") return "Very low relevance";
  return "—";
}

export function coverageLabel(value: string): string {
  if (value === "demonstrated") return "Demonstrated";
  if (value === "partial") return "Partially demonstrated";
  if (value === "not_demonstrated") return "Not demonstrated";
  return value;
}

export function wordBandNote(words: number | null | undefined): string | null {
  if (words == null) return null;
  if (words >= 500) return null;
  if (words >= 400) return "Substantial completion. The 500-word target was not reached.";
  if (words >= 300) return "Review the writing alongside how much of the task it covers.";
  return "This is shorter than the 500-word target. Review the writing closely.";
}

export const CONTENT_REVIEW_ADVISORY = "Automated content analysis is provided to assist teacher review and is not an assessment or support decision.";

export interface KnowledgeReportTopicCoverage {
  key: string;
  label: string;
  coverage: string;
  reason: string;
}

export interface KnowledgeReportContentReview {
  analysisVersion: string;
  overallRelevance: string;
  summary: string;
  topics: KnowledgeReportTopicCoverage[];
  repetitionFlag: boolean;
  repetitionNote: string | null;
}

export function mapKnowledgeReportContentReview(row: unknown): KnowledgeReportContentReview {
  const record = recordOf(row);
  const topics = Array.isArray(record.topics) ? record.topics : [];
  return {
    analysisVersion: text(record.analysis_version ?? record.analysisVersion),
    overallRelevance: text(record.overall_relevance ?? record.overallRelevance),
    summary: text(record.summary),
    topics: topics.map((topic) => {
      const item = recordOf(topic);
      return {
        key: text(item.key),
        label: text(item.label),
        coverage: text(item.coverage),
        reason: text(item.reason),
      };
    }),
    repetitionFlag: nullableBoolean(record.repetition_flag ?? record.repetitionFlag) === true,
    repetitionNote: nullableText(record.repetition_note ?? record.repetitionNote),
  };
}

export function missingLabel(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function reportTextFromEvidence(rows: readonly unknown[]): string {
  for (const row of rows) {
    const record = recordOf(row);
    const payload = recordOf(record.response_payload ?? record.responsePayload);
    if (typeof payload.text === "string" && payload.text.trim()) return payload.text;
  }
  return "";
}

export function canOpenReport(row: Pick<KnowledgeReportRow, "responseId" | "completionStatus">): boolean {
  return Boolean(row.responseId) && (row.completionStatus === "submitted" || row.completionStatus === "reviewed");
}

export const DEMO_KNOWLEDGE_REPORTS: KnowledgeReportRow[] = [
  {
    studentId: "student-a",
    studentNumber: "STUDENT-A",
    learnerName: "Student A",
    groupId: "group-a",
    groupCode: "CYBER-TEST-A",
    groupName: "Cyber Test A",
    courseKey: "ocr-level-3-it",
    activityId: "activity-kr",
    activityKey: "u3-cyber-security-knowledge-report",
    activityVersionId: "version-kr",
    reportTitle: "Cyber Security Knowledge Report",
    assignmentId: "assignment-a",
    completionStatus: "submitted",
    startedAt: "2026-09-23T19:26:44.000Z",
    durationSeconds: 1800,
    wordCount: 684,
    minimumWords: 500,
    minimumMet: true,
    elapsedSeconds: 1457,
    submissionMethod: "manual",
    requiresReview: true,
    submittedAt: "2026-09-23T19:51:01.000Z",
    reviewedAt: null,
    responseId: "response-a",
    overallRelevance: "high",
    repetitionFlag: false,
  },
  {
    studentId: "student-b",
    studentNumber: "STUDENT-B",
    learnerName: "Student B",
    groupId: "group-a",
    groupCode: "CYBER-TEST-A",
    groupName: "Cyber Test A",
    courseKey: "ocr-level-3-it",
    activityId: "activity-kr",
    activityKey: "u3-cyber-security-knowledge-report",
    activityVersionId: "version-kr",
    reportTitle: "Cyber Security Knowledge Report",
    assignmentId: "assignment-a",
    completionStatus: "submitted",
    startedAt: "2026-09-23T18:00:00.000Z",
    durationSeconds: 1800,
    wordCount: 527,
    minimumWords: 500,
    minimumMet: true,
    elapsedSeconds: 1800,
    submissionMethod: "timer_expired",
    requiresReview: true,
    submittedAt: "2026-09-23T18:30:00.000Z",
    reviewedAt: null,
    responseId: "response-b",
    overallRelevance: "high",
    repetitionFlag: false,
  },
  {
    studentId: "student-c",
    studentNumber: "STUDENT-C",
    learnerName: "Student C",
    groupId: "group-a",
    groupCode: "CYBER-TEST-A",
    groupName: "Cyber Test A",
    courseKey: "ocr-level-3-it",
    activityId: "activity-kr",
    activityKey: "u3-cyber-security-knowledge-report",
    activityVersionId: "version-kr",
    reportTitle: "Cyber Security Knowledge Report",
    assignmentId: "assignment-a",
    completionStatus: "reviewed",
    startedAt: "2026-09-22T18:00:00.000Z",
    durationSeconds: 1800,
    wordCount: 341,
    minimumWords: 500,
    minimumMet: false,
    elapsedSeconds: 1800,
    submissionMethod: "timer_expired",
    requiresReview: false,
    submittedAt: "2026-09-22T18:30:00.000Z",
    reviewedAt: "2026-09-23T09:00:00.000Z",
    responseId: "response-c",
    overallRelevance: "very_low",
    repetitionFlag: true,
  },
  {
    studentId: "student-d",
    studentNumber: "STUDENT-D",
    learnerName: "Student D",
    groupId: "group-a",
    groupCode: "CYBER-TEST-A",
    groupName: "Cyber Test A",
    courseKey: "ocr-level-3-it",
    activityId: "activity-kr",
    activityKey: "u3-cyber-security-knowledge-report",
    activityVersionId: "version-kr",
    reportTitle: "Cyber Security Knowledge Report",
    assignmentId: "assignment-a",
    completionStatus: "in_progress",
    startedAt: "2026-09-24T07:00:00.000Z",
    durationSeconds: 1800,
    wordCount: null,
    minimumWords: 500,
    minimumMet: null,
    elapsedSeconds: null,
    submissionMethod: null,
    requiresReview: null,
    submittedAt: null,
    reviewedAt: null,
    responseId: null,
    overallRelevance: null,
    repetitionFlag: null,
  },
  {
    studentId: "student-e",
    studentNumber: "STUDENT-E",
    learnerName: "Student E",
    groupId: "group-a",
    groupCode: "CYBER-TEST-A",
    groupName: "Cyber Test A",
    courseKey: "ocr-level-3-it",
    activityId: "activity-kr",
    activityKey: "u3-cyber-security-knowledge-report",
    activityVersionId: "version-kr",
    reportTitle: "Cyber Security Knowledge Report",
    assignmentId: "assignment-a",
    completionStatus: "not_started",
    startedAt: null,
    durationSeconds: 1800,
    wordCount: null,
    minimumWords: 500,
    minimumMet: null,
    elapsedSeconds: null,
    submissionMethod: null,
    requiresReview: null,
    submittedAt: null,
    reviewedAt: null,
    responseId: null,
    overallRelevance: null,
    repetitionFlag: null,
  },
  {
    studentId: "student-f",
    studentNumber: "STUDENT-F",
    learnerName: "Student F",
    groupId: "group-a",
    groupCode: "CYBER-TEST-A",
    groupName: "Cyber Test A",
    courseKey: "ocr-level-3-it",
    activityId: "activity-kr",
    activityKey: "u3-cyber-security-knowledge-report",
    activityVersionId: "version-kr",
    reportTitle: "Cyber Security Knowledge Report",
    assignmentId: "assignment-a",
    completionStatus: "time_elapsed",
    startedAt: "2026-09-24T06:00:00.000Z",
    durationSeconds: 1800,
    wordCount: null,
    minimumWords: 500,
    minimumMet: null,
    elapsedSeconds: null,
    submissionMethod: null,
    requiresReview: null,
    submittedAt: null,
    reviewedAt: null,
    responseId: null,
    overallRelevance: null,
    repetitionFlag: null,
  },
];

export const DEMO_KNOWLEDGE_REPORT_TEXT = [
  "This is the frozen knowledge report.",
  "",
  "It keeps the paragraph break.",
].join("\n");
