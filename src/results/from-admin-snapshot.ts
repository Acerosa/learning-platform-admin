import {
  buildAssessmentOverview,
  buildAssessmentReadiness,
  buildDiagnostics,
  buildFeedback,
  buildInterventionSignals,
  buildMarkbook,
  buildReviewQueue,
  createActivitySummary,
  createAutomaticFeedback,
  createEvidenceFromPayload,
  createGroupResultSummary,
  createLearnerProgress,
  createTeacherFeedback,
  interpretAttempt,
  mapStoredMarkingSource,
  summariseMarking,
  summariseTrend,
} from "@learning-platform/results";
import type { AdminDataSnapshot, AttemptRecord, ResponseRecord } from "../api/admin-api";

export function progressForLearnerActivity(
  data: AdminDataSnapshot,
  learnerNumber: string,
  activityKey: string,
) {
  const attempts = data.attempts
    .filter((attempt) => attempt.learnerNumber === learnerNumber && attempt.activityKey === activityKey)
    .map((attempt) => ({
      attemptNumber: attempt.attemptNumber,
      completed: attempt.status === "completed",
      score: attempt.score,
      maxScore: attempt.maxScore,
      requiresReview: attempt.requiresReview,
    }));
  return createLearnerProgress({
    learnerId: learnerNumber,
    activityKey,
    attempts,
  });
}

export function groupResultSummaries(data: AdminDataSnapshot) {
  return data.groups.map((group) => {
    const learners = data.learners.filter((learner) => learner.groupCodes.includes(group.groupCode));
    const activityKeys = [...new Set(data.attempts.filter((attempt) => attempt.groupCode === group.groupCode).map((attempt) => attempt.activityKey))];
    const progress = learners.flatMap((learner) =>
      (activityKeys.length ? activityKeys : ["unassigned"]).map((activityKey) =>
        progressForLearnerActivity(data, learner.studentNumber, activityKey),
      ),
    );
    return {
      group,
      summary: createGroupResultSummary({ groupId: group.groupCode, learners: progress }),
    };
  });
}

export function activityResultSummaries(data: AdminDataSnapshot) {
  const keys = [...new Set([
    ...data.attempts.map((attempt) => attempt.activityKey),
    ...data.assignments.map((assignment) => assignment.activityKey),
  ])];
  return keys.map((activityKey) => {
    const learners = [...new Set(data.attempts.filter((attempt) => attempt.activityKey === activityKey).map((attempt) => attempt.learnerNumber))]
      .map((learnerNumber) => progressForLearnerActivity(data, learnerNumber, activityKey));
    const rows = data.attempts.filter((attempt) => attempt.activityKey === activityKey);
    const marking = summariseMarking(rows.map((attempt) => ({
      markingSource: attempt.markingSource,
      requiresReview: attempt.requiresReview,
    })));
    return {
      activityKey,
      questionCount: rows[0]?.questionCount ?? null,
      summary: createActivitySummary({ activityKey, learners }),
      marking,
    };
  });
}

export function resultsDashboard(data: AdminDataSnapshot) {
  const marking = summariseMarking(data.attempts.map((attempt) => ({
    markingSource: attempt.markingSource,
    requiresReview: attempt.requiresReview,
  })));
  const completed = data.attempts.filter((attempt) => attempt.status === "completed");
  const latest = [...data.attempts].sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] ?? null;
  return {
    attemptCount: data.attempts.length,
    completedCount: completed.length,
    averageScore: data.dashboardSummary.averageScorePercentage,
    latestActivity: latest?.activityKey ?? null,
    marking,
  };
}

export function markbookForGroup(data: AdminDataSnapshot, groupCode: string | null) {
  const learners = data.learners
    .filter((learner) => !groupCode || learner.groupCodes.includes(groupCode))
    .map((learner) => ({
      id: learner.studentNumber,
      displayName: learner.displayName,
      learnerNumber: learner.studentNumber,
      groupId: groupCode,
    }));
  const activities = [...new Set(data.assignments
    .filter((assignment) => !groupCode || assignment.groupCode === groupCode)
    .map((assignment) => assignment.activityKey))]
    .map((key) => ({ key }));
  const attempts = data.attempts
    .filter((attempt) => !groupCode || attempt.groupCode === groupCode)
    .map((attempt) => ({
      learnerId: attempt.learnerNumber,
      activityKey: attempt.activityKey,
      attemptNumber: attempt.attemptNumber,
      completed: attempt.status === "completed",
      score: attempt.score,
      maxScore: attempt.maxScore,
      requiresReview: attempt.requiresReview,
    }));
  const group = groupCode
    ? {
        id: groupCode,
        name: data.groups.find((item) => item.groupCode === groupCode)?.groupName ?? groupCode,
        learnerIds: learners.map((learner) => learner.id),
      }
    : null;
  return buildMarkbook({ learners, activities, attempts, group });
}

export function interpretStoredAttempt(attempt: AttemptRecord, responses: readonly ResponseRecord[]) {
  const items = responses.map((response) =>
    createEvidenceFromPayload(response.questionKey, response.questionType, response.responsePayload),
  );
  const marks = responses.map((response) => ({
    questionKey: response.questionKey,
    score: response.score,
    maxScore: response.maxScore,
    isCorrect: response.isCorrect,
    requiresReview: response.requiresReview,
    markingSource: mapStoredMarkingSource(response.markingSource),
  }));
  return interpretAttempt({
    activityKey: attempt.activityKey,
    items,
    marks,
  });
}

export function diagnosticsFromResponses(responses: readonly ResponseRecord[]) {
  return buildDiagnostics(
    responses.flatMap((response) => {
      const result = {
        isCorrect: response.isCorrect,
        requiresReview: response.requiresReview,
      };
      const topics = response.topicKeys.length ? response.topicKeys : [response.sectionKey].filter(Boolean);
      const skills = response.skillKeys;
      if (!topics.length && !skills.length) {
        return [{ questionKey: response.questionKey, result }];
      }
      return [
        ...topics.map((topicKey) => ({ questionKey: response.questionKey, topicKey, result })),
        ...skills.map((skillKey) => ({ questionKey: response.questionKey, skillKey, result })),
      ];
    }),
  );
}

export function feedbackForResponses(responses: readonly ResponseRecord[]) {
  return buildFeedback(
    responses.flatMap((response) => {
      const items = [
        createAutomaticFeedback({
          questionKey: response.questionKey,
          isCorrect: response.isCorrect,
          requiresReview: response.requiresReview,
        }),
      ];
      if (response.feedbackSummary) {
        items.push(
          createTeacherFeedback({
            questionKey: response.questionKey,
            summary: response.feedbackSummary,
            nextStep: response.feedbackNextStep,
          }),
        );
      }
      return items;
    }),
  );
}

export function reviewQueue(responses: readonly ResponseRecord[]) {
  return responses
    .filter((response) => response.requiresReview)
    .map((response) => {
      const reason = buildReviewQueue([{
        questionKey: response.questionKey,
        score: response.score,
        maxScore: response.maxScore,
        isCorrect: response.isCorrect,
        requiresReview: response.requiresReview,
        markingSource: mapStoredMarkingSource(response.markingSource),
      }])[0]?.reason ?? "needs-marking";
      return {
        responseId: response.responseId,
        attemptId: response.attemptId,
        learnerNumber: response.learnerNumber,
        groupCode: response.groupCode,
        activityKey: response.activityKey,
        questionKey: response.questionKey,
        reason,
        markingSource: mapStoredMarkingSource(response.markingSource),
        maxScore: response.maxScore,
        score: response.score,
        isCorrect: response.isCorrect,
      };
    });
}

export function formatEvidenceValue(value: unknown): string {
  if (!value || typeof value !== "object") return String(value ?? "");
  const record = value as Record<string, unknown>;
  if (typeof record.optionId === "string") return record.optionId;
  if (Array.isArray(record.optionIds)) return record.optionIds.join(", ");
  if (typeof record.text === "string") return record.text;
  if (typeof record.sourceCode === "string") return record.sourceCode;
  if (typeof record.categoryId === "string") return record.categoryId;
  if (typeof record.artefactId === "string") return record.artefactId;
  return JSON.stringify(record);
}

export function assessmentOverviewFromSnapshot(data: AdminDataSnapshot) {
  if (!data.assessmentOverview) return null;
  return buildAssessmentOverview(data.assessmentOverview);
}

export function assessmentReadinessFromSnapshot(data: AdminDataSnapshot) {
  const overview = data.assessmentOverview;
  const learnersWithScores = data.learnerPerformance
    .map((learner) => learner.latestScorePercentage)
    .filter((value): value is number => value != null);
  const trend = summariseTrend(learnersWithScores.slice(0, 2));
  const linkedResponses = data.responses.filter((response) => response.topicKeys.length > 0).length;
  const topicCoveragePercentage =
    data.responses.length === 0
      ? null
      : Math.round((linkedResponses / data.responses.length) * 1000) / 10;

  return buildAssessmentReadiness({
    completionPercentage: overview?.completionPercentage ?? null,
    averageScorePercentage:
      overview?.averageScorePercentage ?? data.dashboardSummary.averageScorePercentage,
    trend,
    unresolvedReviewCount: overview?.requiresReviewCount ?? data.responses.filter((row) => row.requiresReview).length,
    topicCoveragePercentage:
      overview && overview.topicLinkCount === 0 ? null : topicCoveragePercentage,
  });
}

export function interventionSignalsFromSnapshot(data: AdminDataSnapshot) {
  return buildInterventionSignals({
    assignedNeverAttempted: data.activityAnalytics.map((row) => ({
      entityKey: `${row.groupCode}:${row.activityKey}`,
      assignedCount: row.assignedLearnerCount,
      attemptedCount: row.attemptedLearnerCount,
    })),
    repeatedAttemptsNoImprovement: data.learnerPerformance.map((row) => ({
      entityKey: row.studentNumber,
      attemptCount: row.attemptCount,
      firstScore: row.firstScorePercentage,
      latestScore: row.latestScorePercentage,
    })),
    lowCompletion: data.activityAnalytics.map((row) => ({
      entityKey: `${row.groupCode}:${row.activityKey}`,
      completionPercentage: row.completionPercentage,
    })),
    unresolvedReviewBacklog: data.groupPerformance.map((row) => ({
      entityKey: row.groupCode,
      requiresReviewCount: row.requiresReviewCount,
    })),
    repeatedLowTopicOrSkill: [
      ...data.topicPerformance.map((row) => ({
        entityType: "topic" as const,
        entityKey: row.topicKey,
        successPercentage: row.successPercentage,
        attemptCount: row.responseCount,
      })),
      ...data.skillPerformance.map((row) => ({
        entityType: "skill" as const,
        entityKey: row.skillKey,
        successPercentage: row.successPercentage,
        attemptCount: row.responseCount,
      })),
    ],
    decliningRecentResults: data.learnerPerformance
      .filter((row) => row.firstScorePercentage != null && row.latestScorePercentage != null)
      .map((row) => ({
        entityKey: row.studentNumber,
        trend: summariseTrend([row.latestScorePercentage!, row.firstScorePercentage!]),
      })),
  });
}
