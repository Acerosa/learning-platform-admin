import assert from "node:assert/strict";
import test from "node:test";
import {
  METRIC_DEFINITIONS,
  activityStatus,
  percentageLabel,
} from "../src/analytics/metrics.ts";
import {
  ALL_SCOPE,
  PANE_FILTERS,
  activityOptions,
  attentionSignalInScope,
  constrainScope,
  learnerSummaries,
  questionsAreGroupScoped,
  scopeFromSearch,
  scopedActivities,
  scopedGroupQuestions,
  scopedLearnerActivity,
  scopedOverview,
  scopedPlatformQuestions,
  searchFromAnalyticsState,
} from "../src/analytics/scope.ts";
import {
  attentionEntityLabel,
  attentionReasonLabel,
  attemptDistribution,
  groupAverage,
  groupDerivedMetrics,
  latestResultDistribution,
} from "../src/analytics/presentation.ts";
import { DEMO_ADMIN_DATA } from "../src/services/demo-admin-service.ts";
import {
  assessmentOverviewFromSnapshot,
  assessmentReadinessFromSnapshot,
  interventionSignalsFromSnapshot,
} from "../src/results/from-admin-snapshot.ts";

test("demo analytics overview interprets backend assessment KPIs", () => {
  const overview = assessmentOverviewFromSnapshot(DEMO_ADMIN_DATA);
  assert.ok(overview);
  assert.equal(overview.activeLearners, 2);
  assert.equal(overview.topicMetadataCoverage, "present");
  assert.equal(overview.skillMetadataCoverage, "present");
});

test("demo readiness indicators stay explainable", () => {
  const readiness = assessmentReadinessFromSnapshot(DEMO_ADMIN_DATA);
  assert.equal(readiness.length, 5);
  assert.ok(readiness.every((item) => item.explanation.length > 0));
});

test("demo intervention signals expose explicit reasons", () => {
  const signals = interventionSignalsFromSnapshot(DEMO_ADMIN_DATA);
  assert.ok(signals.length >= 1);
  assert.ok(signals.every((signal) => /attention|assigned|completion|review|declined|success/i.test(signal.reason) || signal.reason.length > 0));
  assert.ok(signals.some((signal) => signal.key === "assigned-never-attempted" || signal.key === "unresolved-review-backlog" || signal.key === "low-completion"));
});

test("metric labels use agreed terminology", () => {
  assert.equal(METRIC_DEFINITIONS.firstResult.label, "First Result");
  assert.equal(METRIC_DEFINITIONS.latestResult.label, "Latest Result");
  assert.equal(METRIC_DEFINITIONS.bestResult.label, "Best Result");
  assert.equal(METRIC_DEFINITIONS.bestResultAverage.label, "Best-result Average");
  assert.equal(METRIC_DEFINITIONS.highestResult.label, "Highest Result");
  assert.equal(METRIC_DEFINITIONS.attemptAverage.label, "Attempt Average");
  assert.equal(METRIC_DEFINITIONS.completion.label, "Completion");
  assert.equal(METRIC_DEFINITIONS.participation.label, "Participation");
  assert.match(METRIC_DEFINITIONS.firstResult.definition, /first completed attempt/);
  assert.match(METRIC_DEFINITIONS.latestResult.definition, /most recent completed attempt/);
  assert.match(METRIC_DEFINITIONS.bestResultAverage.definition, /Average of each assigned learner-activity Best Result/);
  assert.match(METRIC_DEFINITIONS.highestResult.definition, /not an average/i);
});

test("invalid percentages are not rendered", () => {
  assert.equal(percentageLabel(null), "—");
  assert.equal(percentageLabel(undefined), "—");
  assert.equal(percentageLabel(Number.NaN), "—");
  assert.equal(percentageLabel(Number.POSITIVE_INFINITY), "—");
  assert.equal(percentageLabel(82), "82.0%");
  assert.equal(activityStatus(0, 0), "Not started");
  assert.equal(activityStatus(2, 0), "In progress");
  assert.equal(activityStatus(2, 1), "Complete");
});

test("selecting a course changes applicable learner and activity analytics", () => {
  const all = scopedOverview(DEMO_ADMIN_DATA, constrainScope({
    hubCode: ALL_SCOPE, courseKey: ALL_SCOPE, groupCode: ALL_SCOPE, activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA));
  const tlevel = scopedOverview(DEMO_ADMIN_DATA, constrainScope({
    hubCode: ALL_SCOPE, courseKey: "t-level-digital-software-development", groupCode: ALL_SCOPE, activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA));
  const ocr = scopedOverview(DEMO_ADMIN_DATA, constrainScope({
    hubCode: ALL_SCOPE, courseKey: "ocr-level-3-it", groupCode: ALL_SCOPE, activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA));
  assert.equal(all.assignedLearners, 2);
  assert.equal(tlevel.assignedLearners, 0);
  assert.equal(ocr.assignedLearners, 2);
  assert.ok(ocr.attemptCount > tlevel.attemptCount);
});

test("selecting a group constrains relevant activity results", () => {
  const groupA = constrainScope({
    hubCode: ALL_SCOPE, courseKey: "ocr-level-3-it", groupCode: "TEST-GROUP-A", activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA);
  const activities = scopedActivities(DEMO_ADMIN_DATA, groupA);
  assert.ok(activities.length >= 1);
  assert.ok(activities.every((row) => row.groupCode === "TEST-GROUP-A"));
  assert.ok(activityOptions(DEMO_ADMIN_DATA, groupA).every((option) => option.value !== "missing-activity"));
});

test("selecting an activity changes learner activity context", () => {
  const scoped = constrainScope({
    hubCode: ALL_SCOPE, courseKey: ALL_SCOPE, groupCode: ALL_SCOPE, activityKey: "week3-attacker-types", topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA);
  const rows = scopedLearnerActivity(DEMO_ADMIN_DATA, scoped);
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((row) => row.activityKey === "week3-attacker-types"));
  const learnerA = rows.find((row) => row.studentNumber === "SYNTH-0001");
  assert.equal(learnerA?.firstScorePercentage, 55);
  assert.equal(learnerA?.latestScorePercentage, 82);
  assert.equal(learnerA?.bestScorePercentage, 82);
  const learnerB = rows.find((row) => row.studentNumber === "SYNTH-0002");
  assert.equal(learnerB?.attemptCount, 0);
  assert.equal(learnerB?.firstScorePercentage, null);
});

test("filters which do not apply are not attached to that pane", () => {
  assert.equal(PANE_FILTERS["topics-skills"].has("courseKey"), false);
  assert.equal(PANE_FILTERS["topics-skills"].has("groupCode"), false);
  assert.equal(PANE_FILTERS.learners.has("topicKey"), false);
  assert.equal(PANE_FILTERS.overview.has("activityKey"), true);
  assert.equal(PANE_FILTERS.questions.has("groupCode"), true);
});

test("learner drill-down shows contextual activity rows", () => {
  const summaries = learnerSummaries(DEMO_ADMIN_DATA, constrainScope({
    hubCode: ALL_SCOPE, courseKey: "ocr-level-3-it", groupCode: "TEST-GROUP-A", activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA));
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].displayName, "Synthetic Learner A");
  assert.equal(summaries[0].assignedCount, 2);
  assert.equal(summaries[0].completedCount, 2);
  assert.equal(summaries[0].latestActivityTitle, "Week 3: Attacker Types");
  const attackerTypes = summaries[0].rows.find((row) => row.activityKey === "week3-attacker-types");
  assert.equal(attackerTypes?.firstScorePercentage, 55);
  assert.equal(attackerTypes?.latestScorePercentage, 82);
  assert.equal(summaries[0].attemptAveragePercentage, 75.5);
  assert.equal(activityStatus(attackerTypes?.attemptCount ?? 0, attackerTypes?.completedAttemptCount ?? 0), "Complete");
});

test("activity drill-down includes unattempted assigned learners", () => {
  const scoped = constrainScope({
    hubCode: ALL_SCOPE, courseKey: ALL_SCOPE, groupCode: "TEST-GROUP-B", activityKey: "week3-attacker-types", topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA);
  const rows = scopedLearnerActivity(DEMO_ADMIN_DATA, scoped);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayName, "Synthetic Learner B");
  assert.equal(rows[0].attemptCount, 0);
  assert.equal(activityStatus(rows[0].attemptCount, rows[0].completedAttemptCount), "Not started");
});

test("question analytics stay platform-wide until a group or course is selected", () => {
  const open = constrainScope({
    hubCode: ALL_SCOPE, courseKey: ALL_SCOPE, groupCode: ALL_SCOPE, activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA);
  const grouped = constrainScope({
    hubCode: ALL_SCOPE, courseKey: ALL_SCOPE, groupCode: "TEST-GROUP-A", activityKey: "week3-attacker-types", topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA);
  assert.equal(questionsAreGroupScoped(open), false);
  assert.ok(scopedPlatformQuestions(DEMO_ADMIN_DATA, open).length >= 1);
  assert.equal(questionsAreGroupScoped(grouped), true);
  assert.equal(scopedPlatformQuestions(DEMO_ADMIN_DATA, grouped).length, 0);
  const questions = scopedGroupQuestions(DEMO_ADMIN_DATA, grouped);
  assert.ok(questions.length >= 1);
  assert.ok(questions.every((row) => row.groupCode === "TEST-GROUP-A"));
});

test("needs attention does not imply group scope for topic signals", () => {
  const groupScope = constrainScope({
    hubCode: ALL_SCOPE, courseKey: "ocr-level-3-it", groupCode: "TEST-GROUP-A", activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA);
  const context = {
    learnerNumbers: ["SYNTH-0001"],
    groupCodes: ["TEST-GROUP-A"],
    activities: [{ groupCode: "TEST-GROUP-A", activityKey: "week3-attacker-types" }],
  };
  assert.equal(attentionSignalInScope({ entityType: "topic", entityKey: "networks" }, groupScope, context), false);
  assert.equal(attentionSignalInScope({ entityType: "learner", entityKey: "SYNTH-0001" }, groupScope, context), true);
  assert.equal(attentionSignalInScope({ entityType: "activity", entityKey: "TEST-GROUP-A:week3-attacker-types" }, groupScope, context), true);
  assert.equal(attentionSignalInScope({ entityType: "activity", entityKey: "TEST-GROUP-B:week3-attacker-types" }, groupScope, context), false);
});

test("empty scoped analytics stay numeric rather than undefined", () => {
  const empty = scopedOverview(DEMO_ADMIN_DATA, constrainScope({
    hubCode: "tlevel-software-development", courseKey: ALL_SCOPE, groupCode: ALL_SCOPE, activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA));
  assert.equal(empty.assignedLearners, 0);
  assert.equal(empty.attemptCount, 0);
  assert.equal(empty.latestResultAverage, null);
  assert.equal(percentageLabel(empty.latestResultAverage), "—");
});

test("search params round-trip analytics scope without a router rewrite", () => {
  const search = searchFromAnalyticsState({
    pane: "learners",
    learnerId: "learner-a",
    assignmentId: null,
    inspectGroup: "TEST-GROUP-A",
    scope: {
      hubCode: "unit-3-cyber-security",
      courseKey: "ocr-level-3-it",
      groupCode: "TEST-GROUP-A",
      activityKey: "week3-attacker-types",
      topicKey: ALL_SCOPE,
      skillKey: ALL_SCOPE,
    },
  });
  const parsed = scopeFromSearch(search);
  assert.equal(parsed.pane, "learners");
  assert.equal(parsed.hubCode, "unit-3-cyber-security");
  assert.equal(parsed.courseKey, "ocr-level-3-it");
  assert.equal(parsed.groupCode, "TEST-GROUP-A");
  assert.equal(parsed.activityKey, "week3-attacker-types");
  assert.equal(parsed.learnerId, "learner-a");
  assert.equal(parsed.inspectGroup, "TEST-GROUP-A");
});

test("latest-result distribution uses existing scores and does not treat missing as 0%", () => {
  const rows = scopedLearnerActivity(DEMO_ADMIN_DATA, constrainScope({
    hubCode: ALL_SCOPE, courseKey: "ocr-level-3-it", groupCode: ALL_SCOPE, activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA));
  const buckets = latestResultDistribution(rows);
  const high = buckets.find((bucket) => bucket.id === "high");
  const none = buckets.find((bucket) => bucket.id === "none");
  const low = buckets.find((bucket) => bucket.id === "low");
  assert.equal(high?.count, 1);
  assert.equal(none?.count, 1);
  assert.equal(low?.count, 0);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.count, 0), 2);
});

test("attempt distribution includes not started without inventing a score", () => {
  const rows = scopedLearnerActivity(DEMO_ADMIN_DATA, constrainScope({
    hubCode: ALL_SCOPE, courseKey: ALL_SCOPE, groupCode: ALL_SCOPE, activityKey: "week3-attacker-types", topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, DEMO_ADMIN_DATA));
  const buckets = attemptDistribution(rows);
  assert.equal(buckets.find((bucket) => bucket.id === "0")?.count, 1);
  assert.equal(buckets.find((bucket) => bucket.id === "3")?.count, 1);
});

test("group drill-down metrics stay on the selected teaching group", () => {
  const group = DEMO_ADMIN_DATA.groupPerformance.find((row) => row.groupCode === "TEST-GROUP-A");
  assert.ok(group);
  const derived = groupDerivedMetrics(group, DEMO_ADMIN_DATA.learnerActivityPerformance, DEMO_ADMIN_DATA.activityAnalytics);
  assert.equal(derived.assignedLearners, 1);
  assert.equal(derived.completedLearners, 1);
  assert.equal(derived.completionPercentage, 100);
  assert.ok(derived.lastActivity);
});

test("needs attention reasons stay on existing deterministic signals", () => {
  assert.equal(attentionReasonLabel("assigned-never-attempted"), "No activity");
  assert.equal(attentionReasonLabel("low-completion"), "Completion risk");
  assert.equal(attentionReasonLabel("unresolved-review-backlog"), "Awaiting review");
  assert.equal(attentionReasonLabel("repeated-attempts-no-improvement"), "Low performance");
});

test("needs attention entity labels stay on the friendly name without concatenating the key", () => {
  const label = attentionEntityLabel(
    { entityType: "group", entityKey: "CYBER-TEST-A" },
    {
      learners: [],
      groups: [{ groupCode: "CYBER-TEST-A", groupName: "Cyber Security Synthetic Test Group A" }],
      activities: [],
    },
  );
  assert.equal(label, "Cyber Security Synthetic Test Group A");
  assert.doesNotMatch(label, /ACYBER-TEST-A/);
});

test("group highest result is the maximum group best, not the average of bests", () => {
  const summary = groupAverage([
    { ...DEMO_ADMIN_DATA.groupPerformance[0], bestScorePercentage: 74 },
    { ...DEMO_ADMIN_DATA.groupPerformance[1], bestScorePercentage: 100 },
  ]);
  assert.equal(summary.best, 87);
  assert.equal(summary.highest, 100);
});

test("activity learner rows remain after the first simulated page", () => {
  const filler = Array.from({ length: 1001 }, (_, index) => ({
    ...DEMO_ADMIN_DATA.learnerActivityPerformance[0],
    learnerId: `filler-${index}`,
    studentNumber: `PAD-${index}`,
    displayName: `Filler ${index}`,
    assignmentId: `filler-assignment-${index}`,
    activityKey: `filler-activity-${index}`,
    activityTitle: `Filler ${index}`,
  }));
  const synth = {
    ...DEMO_ADMIN_DATA.learnerActivityPerformance[0],
    learnerId: "synth-0001",
    studentNumber: "SYNTH-0001",
    displayName: "Synthetic Student A",
    groupCode: "TEST-GROUP-A",
    assignmentId: "assignment-requirements",
    activityKey: "foundations-requirements-classification",
    activityTitle: "Requirements Classification",
    attemptCount: 9,
    completedAttemptCount: 9,
    firstScorePercentage: 50,
    latestScorePercentage: 5,
    bestScorePercentage: 100,
    averageScorePercentage: 78.33,
  };
  const data = {
    ...DEMO_ADMIN_DATA,
    learnerActivityPerformance: [...filler, synth],
    activityAnalytics: [
      ...DEMO_ADMIN_DATA.activityAnalytics,
      {
        ...DEMO_ADMIN_DATA.activityAnalytics[1],
        groupCode: "TEST-GROUP-A",
        assignmentId: "assignment-requirements",
        activityKey: "foundations-requirements-classification",
        activityTitle: "Requirements Classification",
      },
    ],
  };
  const rows = scopedLearnerActivity(data, constrainScope({
    hubCode: ALL_SCOPE,
    courseKey: ALL_SCOPE,
    groupCode: "TEST-GROUP-A",
    activityKey: "foundations-requirements-classification",
    topicKey: ALL_SCOPE,
    skillKey: ALL_SCOPE,
  }, data));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayName, "Synthetic Student A");
  assert.equal(rows[0].attemptCount, 9);
  assert.equal(rows[0].firstScorePercentage, 50);
  assert.equal(rows[0].latestScorePercentage, 5);
  assert.equal(rows[0].bestScorePercentage, 100);
  assert.equal(rows[0].averageScorePercentage, 78.33);
  assert.equal(activityStatus(rows[0].attemptCount, rows[0].completedAttemptCount), "Complete");
});

test("questions pane count uses the complete loaded dataset rather than a 1000-row cap", () => {
  const questionPerformance = Array.from({ length: 1562 }, (_, index) => ({
    activityKey: "foundations-requirements-classification",
    activityVersion: "1.0.0",
    questionKey: `Q-${index}`,
    questionType: "single",
    sectionKey: "section-a",
    topicKeys: [],
    skillKeys: [],
    responseCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    requiresReviewCount: 0,
    reviewedResponseCount: 0,
    correctnessPercentage: null,
    averageAwardedScore: null,
    averageMaxScore: null,
  }));
  const data = { ...DEMO_ADMIN_DATA, questionPerformance };
  const rows = scopedPlatformQuestions(data, constrainScope({
    hubCode: ALL_SCOPE, courseKey: ALL_SCOPE, groupCode: ALL_SCOPE, activityKey: ALL_SCOPE, topicKey: ALL_SCOPE, skillKey: ALL_SCOPE,
  }, data));
  assert.equal(rows.length, 1562);
});

