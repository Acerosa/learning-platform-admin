import type {
  DiagnosticResponseRecord,
  DiagnosticSessionRecord,
  DiagnosticSessionStatus,
  DiagnosticSummaryRecord,
} from "../api/admin-api.ts";

export const READINESS_HUB_CODE = "level-3-it-year-1-readiness";
export const READINESS_COURSE_KEY = "ocr-level-3-it";
export const READINESS_DIAGNOSTIC_NAME = "Level 3 IT Year 1 Readiness Diagnostic";

export const DIAGNOSTIC_UNIT_ORDER = [
  "general",
  "global-information",
  "fundamentals-of-it",
  "cyber-security",
  "web-design",
] as const;

export type DiagnosticUnitKey = (typeof DIAGNOSTIC_UNIT_ORDER)[number];

export const DIAGNOSTIC_UNIT_LABELS: Record<DiagnosticUnitKey, string> = {
  general: "Getting started",
  "global-information": "Global Information Storage & Transmission",
  "fundamentals-of-it": "Fundamentals of IT",
  "cyber-security": "Cyber Security",
  "web-design": "Web Design and Prototyping",
};

export const QUESTION_LABEL_GAP =
  "Question and option labels are not yet available from admin_api. Identifiers are shown until content labels are exposed.";

export const UNAVAILABLE_RESULT = "—";
export const EXPECTED_READINESS_QUESTION_COUNT = 25;

export type DiagnosticStatusFilter = "all" | "completed" | "incomplete";
export type DiagnosticDateFilter = "all" | "last-24-hours" | "last-7-days";

export interface DiagnosticOverviewMetrics {
  diagnosticName: string;
  hubCode: string;
  hubName: string;
  courseKey: string;
  courseTitle: string;
  startedCount: number;
  completedCount: number;
  completionPercentage: number | null;
  responseCount: number;
  notSureCount: number;
  notSurePercentage: number | null;
}

export interface DiagnosticQuestionDistribution {
  unitKey: string;
  unitLabel: string;
  activityId: string;
  questionKey: string;
  responseCount: number;
  notSureCount: number;
  optionCounts: readonly { id: string; count: number }[];
  confidenceCounts: readonly { value: string; count: number }[];
}

export interface DiagnosticUnitGroup {
  unitKey: string;
  unitLabel: string;
  responses: readonly DiagnosticResponseRecord[];
}

export function diagnosticUnitLabel(unitKey: string): string {
  return DIAGNOSTIC_UNIT_LABELS[unitKey as DiagnosticUnitKey] ?? unitKey;
}

export function formatDiagnosticStatus(status: DiagnosticSessionStatus | string): string {
  if (status === "started") return "In progress";
  if (status === "completed") return "Completed";
  if (status === "abandoned") return "Abandoned";
  return status;
}

export function formatCompletionRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function selectReadinessSummary(
  summaries: readonly DiagnosticSummaryRecord[],
): DiagnosticSummaryRecord | null {
  return summaries.find((row) => row.hubCode === READINESS_HUB_CODE && row.courseKey === READINESS_COURSE_KEY)
    ?? summaries.find((row) => row.courseKey === READINESS_COURSE_KEY)
    ?? summaries[0]
    ?? null;
}

export function diagnosticOverview(
  summaries: readonly DiagnosticSummaryRecord[],
  sessions: readonly DiagnosticSessionRecord[],
): DiagnosticOverviewMetrics | null {
  const summary = selectReadinessSummary(summaries);
  const sample = sessions.find((row) =>
    (!summary || row.hubCode === summary.hubCode) && (!summary || row.courseKey === summary.courseKey),
  ) ?? sessions[0];
  if (!summary && !sample) return null;
  return {
    diagnosticName: sample?.hubName || READINESS_DIAGNOSTIC_NAME,
    hubCode: summary?.hubCode ?? sample?.hubCode ?? READINESS_HUB_CODE,
    hubName: sample?.hubName || READINESS_DIAGNOSTIC_NAME,
    courseKey: summary?.courseKey ?? sample?.courseKey ?? READINESS_COURSE_KEY,
    courseTitle: sample?.courseTitle || READINESS_COURSE_KEY,
    startedCount: summary?.startedCount ?? sessions.length,
    completedCount: summary?.completedCount ?? sessions.filter((row) => row.status === "completed").length,
    completionPercentage: summary?.completionPercentage
      ?? (sessions.length
        ? Number(((sessions.filter((row) => row.status === "completed").length / sessions.length) * 100).toFixed(2))
        : null),
    responseCount: summary?.responseCount ?? sessions.reduce((total, row) => total + row.responseCount, 0),
    notSureCount: summary?.notSureCount ?? sessions.reduce((total, row) => total + row.notSureCount, 0),
    notSurePercentage: summary?.notSurePercentage
      ?? (summary?.responseCount
        ? null
        : (() => {
          const total = sessions.reduce((count, row) => count + row.responseCount, 0);
          const notSure = sessions.reduce((count, row) => count + row.notSureCount, 0);
          return total ? Number(((notSure / total) * 100).toFixed(2)) : null;
        })()),
  };
}

export function recentDiagnosticSessions(
  sessions: readonly DiagnosticSessionRecord[],
  limit = 5,
): readonly DiagnosticSessionRecord[] {
  return [...sessions]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, limit);
}

export function filterDiagnosticSessions(
  sessions: readonly DiagnosticSessionRecord[],
  filters: {
    status: DiagnosticStatusFilter;
    query: string;
    version?: string;
    date?: DiagnosticDateFilter;
    now?: number;
  },
): readonly DiagnosticSessionRecord[] {
  const query = filters.query.trim().toLowerCase();
  const now = filters.now ?? Date.now();
  return sessions.filter((session) => {
    if (filters.status === "completed" && session.status !== "completed") return false;
    if (filters.status === "incomplete" && session.status === "completed") return false;
    if (filters.version && diagnosticVersionLabel(session) !== filters.version) return false;
    if (filters.date && filters.date !== "all") {
      const activity = Date.parse(lastActivityAt(session));
      if (!Number.isFinite(activity)) return false;
      const windowMs = filters.date === "last-24-hours" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      if (now - activity > windowMs) return false;
    }
    if (!query) return true;
    return session.studentName.toLowerCase().includes(query)
      || session.studentId.toLowerCase().includes(query);
  });
}

export function sortDiagnosticSessionsByRecent(
  sessions: readonly DiagnosticSessionRecord[],
): readonly DiagnosticSessionRecord[] {
  return [...sessions].sort((left, right) => lastActivityAt(right).localeCompare(lastActivityAt(left)));
}

export function diagnosticVersionLabel(session: DiagnosticSessionRecord): string {
  return session.diagnosticVersion?.trim() || UNAVAILABLE_RESULT;
}

export function lastActivityAt(session: DiagnosticSessionRecord): string {
  return session.completedAt || session.startedAt;
}

export interface DiagnosticUnitScore {
  unitKey: string;
  unitLabel: string;
  awardedScore: number;
  maxScore: number;
  percentage: number | null;
}

export function formatScoreNumber(value: number): string {
  if (!Number.isFinite(value)) return UNAVAILABLE_RESULT;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function formatDiagnosticPercentage(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return UNAVAILABLE_RESULT;
  const label = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${label}%`;
}

export function formatDiagnosticScore(input: {
  awardedScore: number | null | undefined;
  maxScore: number | null | undefined;
  scorePercentage?: number | null;
}): string {
  if (input.awardedScore == null || input.maxScore == null || input.maxScore <= 0) {
    return UNAVAILABLE_RESULT;
  }
  const raw = `${formatScoreNumber(input.awardedScore)} / ${formatScoreNumber(input.maxScore)}`;
  if (input.scorePercentage == null || !Number.isFinite(input.scorePercentage)) return raw;
  return `${raw} (${formatDiagnosticPercentage(input.scorePercentage).replace("%", "")}%)`;
}

export function diagnosticSessionScoreLabel(session: DiagnosticSessionRecord): string {
  return formatDiagnosticScore({
    awardedScore: session.awardedScore,
    maxScore: session.maxScore,
    scorePercentage: session.status === "completed" ? session.scorePercentage : null,
  });
}

export function diagnosticScoreLabel(
  responses: readonly DiagnosticResponseRecord[],
  session?: DiagnosticSessionRecord | null,
): string {
  if (session) return diagnosticSessionScoreLabel(session);
  const scored = responses.filter((row) => row.awardedScore != null && (row.maxScore ?? 0) > 0);
  if (!scored.length) return UNAVAILABLE_RESULT;
  const awarded = scored.reduce((sum, row) => sum + (row.awardedScore ?? 0), 0);
  const max = scored.reduce((sum, row) => sum + (row.maxScore ?? 0), 0);
  return formatDiagnosticScore({ awardedScore: awarded, maxScore: max });
}

export function diagnosticPercentageLabel(
  responses: readonly DiagnosticResponseRecord[],
  expectedQuestionCount?: number,
  session?: DiagnosticSessionRecord | null,
): string {
  if (session) {
    if (session.status !== "completed" || session.maxScore == null || session.maxScore <= 0) {
      return UNAVAILABLE_RESULT;
    }
    return formatDiagnosticPercentage(session.scorePercentage);
  }
  void expectedQuestionCount;
  const scored = responses.filter((row) => row.awardedScore != null && (row.maxScore ?? 0) > 0);
  if (!scored.length) return UNAVAILABLE_RESULT;
  const awarded = scored.reduce((sum, row) => sum + (row.awardedScore ?? 0), 0);
  const max = scored.reduce((sum, row) => sum + (row.maxScore ?? 0), 0);
  if (max <= 0) return UNAVAILABLE_RESULT;
  return formatDiagnosticPercentage(Number(((awarded / max) * 100).toFixed(1)));
}

export function diagnosticUnitScores(
  responses: readonly DiagnosticResponseRecord[],
): readonly DiagnosticUnitScore[] {
  return groupResponsesByUnit(responses).flatMap((group) => {
    const scored = group.responses.filter((row) => (row.maxScore ?? 0) > 0);
    if (!scored.length) return [];
    const awarded = scored.reduce((sum, row) => sum + (row.awardedScore ?? 0), 0);
    const max = scored.reduce((sum, row) => sum + (row.maxScore ?? 0), 0);
    return [{
      unitKey: group.unitKey,
      unitLabel: group.unitLabel,
      awardedScore: awarded,
      maxScore: max,
      percentage: max > 0 ? Number(((awarded / max) * 100).toFixed(1)) : null,
    }];
  });
}

export function responseMarkLabel(response: DiagnosticResponseRecord): string {
  if (response.isCorrect === true) return "Correct";
  if (response.isCorrect === false) return "Not correct";
  return "Unmarked";
}

export function responseAwardedLabel(response: DiagnosticResponseRecord): string {
  if (response.awardedScore == null || response.maxScore == null) return UNAVAILABLE_RESULT;
  if (response.maxScore <= 0) return UNAVAILABLE_RESULT;
  return `${formatScoreNumber(response.awardedScore)} / ${formatScoreNumber(response.maxScore)}`;
}

export function questionCatalogue(
  responses: readonly DiagnosticResponseRecord[],
): readonly { activityId: string; questionKey: string }[] {
  const seen = new Map<string, { activityId: string; questionKey: string }>();
  for (const row of responses) {
    const key = `${row.activityId}::${row.questionKey}`;
    if (!seen.has(key)) seen.set(key, { activityId: row.activityId, questionKey: row.questionKey });
  }
  return [...seen.values()];
}

export function unansweredQuestions(
  sessionResponses: readonly DiagnosticResponseRecord[],
  catalogue: readonly { activityId: string; questionKey: string }[],
): readonly { activityId: string; questionKey: string }[] {
  const answered = new Set(sessionResponses.map((row) => `${row.activityId}::${row.questionKey}`));
  return catalogue.filter((item) => !answered.has(`${item.activityId}::${item.questionKey}`));
}

export function diagnosticVersions(
  sessions: readonly DiagnosticSessionRecord[],
): readonly string[] {
  return [...new Set(sessions.map((session) => diagnosticVersionLabel(session)).filter((value) => value !== UNAVAILABLE_RESULT))].sort();
}

export function responsesForSession(
  responses: readonly DiagnosticResponseRecord[],
  sessionId: string,
): readonly DiagnosticResponseRecord[] {
  return responses.filter((row) => row.sessionId === sessionId);
}

export function groupResponsesByUnit(
  responses: readonly DiagnosticResponseRecord[],
): readonly DiagnosticUnitGroup[] {
  const buckets = new Map<string, DiagnosticResponseRecord[]>();
  for (const response of responses) {
    const key = response.unitKey || "general";
    const list = buckets.get(key) ?? [];
    list.push(response);
    buckets.set(key, list);
  }
  const known = DIAGNOSTIC_UNIT_ORDER
    .filter((unitKey) => buckets.has(unitKey))
    .map((unitKey) => ({
      unitKey,
      unitLabel: diagnosticUnitLabel(unitKey),
      responses: buckets.get(unitKey) ?? [],
    }));
  const extra = [...buckets.keys()]
    .filter((unitKey) => !DIAGNOSTIC_UNIT_ORDER.includes(unitKey as DiagnosticUnitKey))
    .sort()
    .map((unitKey) => ({
      unitKey,
      unitLabel: diagnosticUnitLabel(unitKey),
      responses: buckets.get(unitKey) ?? [],
    }));
  return [...known, ...extra];
}

export function hasAuthoritativeCorrectness(
  responses: readonly DiagnosticResponseRecord[],
): boolean {
  return responses.some((row) => row.isCorrect !== null);
}

export function correctnessLabel(value: boolean | null): string | null {
  if (value === true) return "Correct";
  if (value === false) return "Not correct";
  return null;
}

export function evidenceOptionId(evidence: unknown): string | null {
  if (typeof evidence === "string" && evidence.trim()) return evidence.trim();
  if (evidence && typeof evidence === "object" && !Array.isArray(evidence) && "optionId" in evidence) {
    const id = (evidence as { optionId?: unknown }).optionId;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }
  return null;
}

export function formatEvidence(evidence: unknown): string {
  const optionId = evidenceOptionId(evidence);
  if (optionId) return optionId;
  if (evidence == null) return "—";
  if (typeof evidence === "string") return evidence || "—";
  try {
    return JSON.stringify(evidence);
  } catch {
    return "—";
  }
}

export function questionDistributions(
  responses: readonly DiagnosticResponseRecord[],
): readonly DiagnosticQuestionDistribution[] {
  const grouped = new Map<string, DiagnosticResponseRecord[]>();
  for (const response of responses) {
    const key = `${response.unitKey}::${response.activityId}::${response.questionKey}`;
    const list = grouped.get(key) ?? [];
    list.push(response);
    grouped.set(key, list);
  }
  return [...grouped.values()].map((rows) => {
    const sample = rows[0];
    const optionCounts = new Map<string, number>();
    const confidenceCounts = new Map<string, number>();
    for (const row of rows) {
      const optionId = evidenceOptionId(row.evidence);
      if (optionId) optionCounts.set(optionId, (optionCounts.get(optionId) ?? 0) + 1);
      if (row.confidence) {
        confidenceCounts.set(row.confidence, (confidenceCounts.get(row.confidence) ?? 0) + 1);
      }
    }
    return {
      unitKey: sample.unitKey,
      unitLabel: diagnosticUnitLabel(sample.unitKey),
      activityId: sample.activityId,
      questionKey: sample.questionKey,
      responseCount: rows.length,
      notSureCount: rows.filter((row) => row.isNotSure).length,
      optionCounts: [...optionCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([id, count]) => ({ id, count })),
      confidenceCounts: [...confidenceCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([value, count]) => ({ value, count })),
    };
  });
}
