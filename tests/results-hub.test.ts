import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ASSIGNMENT_MARKBOOK_SOURCE_ID,
  INDUCTION_READINESS_SOURCE_ID,
  RESULT_SOURCES,
  resultSourceById,
} from "../src/results/result-sources.ts";
import {
  cascadeHubLearningFilters,
  completionLabel,
  DEMO_HUB_LEARNING_FILTERS,
  DEMO_HUB_LEARNING_RESULTS,
  EMPTY_HUB_LEARNING_FILTERS,
  hubLearningRpcParams,
  mapHubLearningResultRow,
  percentageLabel,
  scoreLabel,
  uniqueGroups,
  uniqueLearners,
  uniqueWeeks,
} from "../src/results/hub-learning.ts";

const root = new URL("../", import.meta.url);

test("hub learning sources share one contract and keep L3E unavailable", () => {
  const unit3 = resultSourceById("unit-3-cyber-security");
  const tlevel = resultSourceById("tlevel");
  const l2e = resultSourceById("l2e");
  const unit14 = resultSourceById("unit-14");
  const l3e = resultSourceById("l3e");
  assert.equal(unit3?.kind, "hub-learning");
  assert.equal(unit3?.available, true);
  assert.equal(unit3?.hubCode, "unit-3-cyber-security");
  assert.equal(tlevel?.hubCode, "tlevel-software-development");
  assert.equal(l2e?.hubCode, "l2e-exploring-emerging-digital-technologies");
  assert.equal(unit14?.hubCode, "unit-14-software-engineering-for-business");
  assert.equal(l3e?.available, false);
  assert.equal(l3e?.kind, "unavailable");
  assert.equal(resultSourceById(INDUCTION_READINESS_SOURCE_ID)?.kind, "diagnostic");
  assert.equal(resultSourceById(ASSIGNMENT_MARKBOOK_SOURCE_ID)?.kind, "assignment-markbook");
  assert.equal(RESULT_SOURCES.filter((source) => source.kind === "hub-learning").length, 4);
});

test("Results area routes hub-learning through the shared page", async () => {
  const [area, sources, page] = await Promise.all([
    readFile(new URL("src/views/results-area.tsx", root), "utf8"),
    readFile(new URL("src/results/result-sources.ts", root), "utf8"),
    readFile(new URL("src/views/hub-learning-results.tsx", root), "utf8"),
  ]);
  assert.match(area, /HubLearningResultsPage/);
  assert.match(area, /kind === "hub-learning"/);
  assert.match(sources, /hub-learning/);
  assert.match(page, /data-testid="hub-learning-results"/);
  assert.match(page, /data-testid="hub-learning-filters"/);
  assert.match(page, /data-testid="hub-learning-loading"/);
  assert.match(page, /data-testid="hub-learning-empty"/);
  assert.match(page, /data-testid="hub-learning-error"/);
  assert.match(page, /list_hub_learning_results/);
  assert.match(page, /list_hub_learning_result_evidence/);
});

test("changing hub-level filters drops invalid downstream selections", () => {
  const next = cascadeHubLearningFilters(DEMO_HUB_LEARNING_FILTERS, {
    ...EMPTY_HUB_LEARNING_FILTERS,
    courseKey: "missing-course",
    groupCode: "CYBER-DEMO",
    studentNumber: "DEMO-1001",
    weekNumber: "1",
    sessionNumber: "1",
    activityKey: "demo-scored-quiz",
  });
  assert.equal(next.groupCode, "");
  assert.equal(next.studentNumber, "");
  const byGroup = cascadeHubLearningFilters(DEMO_HUB_LEARNING_FILTERS, {
    ...EMPTY_HUB_LEARNING_FILTERS,
    courseKey: "ocr-level-3-it",
    groupCode: "OTHER",
    studentNumber: "DEMO-1001",
  });
  assert.equal(byGroup.groupCode, "");
  assert.equal(byGroup.studentNumber, "");
});

test("group selection constrains learners to current members in the filter rows", () => {
  const learners = uniqueLearners(DEMO_HUB_LEARNING_FILTERS, {
    ...EMPTY_HUB_LEARNING_FILTERS,
    courseKey: "ocr-level-3-it",
    groupCode: "CYBER-DEMO",
  });
  assert.deepEqual(learners.map((item) => item.value), ["DEMO-1001", "DEMO-1002"]);
  const groups = uniqueGroups(DEMO_HUB_LEARNING_FILTERS, "ocr-level-3-it");
  assert.equal(groups.length, 1);
  const weeks = uniqueWeeks(DEMO_HUB_LEARNING_FILTERS, {
    ...EMPTY_HUB_LEARNING_FILTERS,
    groupCode: "CYBER-DEMO",
  });
  assert.deepEqual(weeks.map((item) => item.value), ["1", "2"]);
});

test("scored rows show a percentage and unscored rows stay as an em dash", () => {
  const scored = DEMO_HUB_LEARNING_RESULTS[0];
  const unscored = DEMO_HUB_LEARNING_RESULTS[1];
  assert.equal(scoreLabel(scored), "8 / 10");
  assert.equal(percentageLabel(scored.scorePercentage), "80%");
  assert.equal(completionLabel(scored), "Completed");
  assert.equal(scoreLabel(unscored), "—");
  assert.equal(percentageLabel(unscored.scorePercentage), "—");
  assert.equal(completionLabel(unscored), "In progress");
});

test("RPC params send hub_code and student_number, not a browser learner_id", () => {
  const params = hubLearningRpcParams("unit-3-cyber-security", {
    ...EMPTY_HUB_LEARNING_FILTERS,
    groupCode: "CYBER-DEMO",
    studentNumber: "DEMO-1001",
    weekNumber: "1",
  });
  assert.equal(params.p_hub_code, "unit-3-cyber-security");
  assert.equal(params.p_group_code, "CYBER-DEMO");
  assert.equal(params.p_student_number, "DEMO-1001");
  assert.equal(params.p_week_number, 1);
  assert.equal("p_learner_id" in params, false);
});

test("snake_case RPC rows map into the shared result contract", () => {
  const row = mapHubLearningResultRow({
    hub_code: "unit-3-cyber-security",
    course_key: "ocr-level-3-it",
    course_title: "OCR Level 3 IT",
    group_code: "CYBER-DEMO",
    group_name: "Demo Cyber Group",
    student_number: "DEMO-1001",
    display_name: "Alex Demo",
    assignment_id: "assign-1",
    activity_key: "quiz",
    activity_title: "Quiz",
    activity_version: "1.0.0",
    week_number: 1,
    week_title: "Week 1",
    session_number: 1,
    completion_status: "completed",
    result_source: "official_attempt",
    scored: true,
    attempt_id: "attempt-1",
    attempt_status: "completed",
    score: 8,
    max_score: 10,
    score_percentage: 80,
    correct_count: 4,
    incorrect_count: 1,
    attempt_count: 1,
    formative_check_count: 0,
    last_activity_at: "2026-09-03T12:05:00.000Z",
    completed_at: "2026-09-03T12:05:00.000Z",
  });
  assert.equal(row.studentNumber, "DEMO-1001");
  assert.equal(row.scored, true);
  assert.equal(row.scorePercentage, 80);
});
