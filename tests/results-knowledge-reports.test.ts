import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resultSourceById } from "../src/results/result-sources.ts";
import {
  DEMO_KNOWLEDGE_REPORTS,
  canOpenReport,
  distinctStandardTimeText,
  filterKnowledgeReports,
  formatElapsed,
  extraTimeLabel,
  frozenEvidenceFromResponse,
  knowledgeReportDetailFacts,
  mapKnowledgeReportRow,
  minimumEvidenceLabel,
  missingLabel,
  reportTextFromEvidence,
  submissionMethodLabel,
} from "../src/results/knowledge-reports.ts";

const root = new URL("../", import.meta.url);

test("Knowledge Reports is a Results source, not a separate application", async () => {
  const source = resultSourceById("knowledge-reports");
  assert.equal(source?.kind, "knowledge-reports");
  assert.equal(source?.available, true);
  assert.equal(source?.label, "Knowledge Reports");
  const [area, navigation] = await Promise.all([
    readFile(new URL("src/views/results-area.tsx", root), "utf8"),
    readFile(new URL("src/router/modules.ts", root), "utf8"),
  ]);
  assert.match(area, /KnowledgeReportsPage/);
  assert.match(area, /kind === "knowledge-reports"/);
  assert.doesNotMatch(navigation, /knowledge-reports/);
});

test("filters narrow the assigned cohort without a separate filter framework", () => {
  const notStarted = filterKnowledgeReports(DEMO_KNOWLEDGE_REPORTS, {
    courseKey: "ocr-level-3-it",
    groupCode: "CYBER-TEST-A",
    studentNumber: "",
    activityKey: "u3-cyber-security-knowledge-report",
    completionStatus: "not_started",
    minimumMet: "",
    reviewStatus: "",
    relevance: "",
  });
  assert.deepEqual(notStarted.map((row) => row.learnerName), ["Student E"]);
  const belowMinimum = filterKnowledgeReports(DEMO_KNOWLEDGE_REPORTS, {
    courseKey: "",
    groupCode: "",
    studentNumber: "",
    activityKey: "",
    completionStatus: "",
    minimumMet: "not_reached",
    reviewStatus: "reviewed",
    relevance: "very_low",
  });
  assert.deepEqual(belowMinimum.map((row) => row.learnerName), ["Student C"]);
});

test("the cohort table uses factual metadata and leaves missing values blank", () => {
  const elapsed = DEMO_KNOWLEDGE_REPORTS.find((row) => row.completionStatus === "time_elapsed");
  assert.ok(elapsed);
  assert.equal(missingLabel(elapsed.wordCount), "—");
  assert.equal(formatElapsed(elapsed.elapsedSeconds), "—");
  assert.equal(canOpenReport(elapsed), false);
  assert.equal(formatElapsed(808), "13:28");
  assert.equal(formatElapsed(1800), "30:00");
  assert.equal(submissionMethodLabel("manual"), "Manual");
  assert.equal(submissionMethodLabel("timer_expired"), "Time expired");
  assert.equal(submissionMethodLabel("standard_time_complete"), "Standard time complete");
  assert.equal(submissionMethodLabel("additional_time_expired"), "Additional time expired");
  assert.equal(extraTimeLabel({ additionalTimeEligible: null, additionalTimeStarted: null, additionalTimeUsedSeconds: null }), "—");
  assert.equal(extraTimeLabel({ additionalTimeEligible: true, additionalTimeStarted: false, additionalTimeUsedSeconds: null }), "Offered");
  assert.equal(extraTimeLabel({ additionalTimeEligible: false, additionalTimeStarted: false, additionalTimeUsedSeconds: null }), "Not used");
  assert.equal(extraTimeLabel({ additionalTimeEligible: true, additionalTimeStarted: true, additionalTimeUsedSeconds: 900 }), "+15 min");
  assert.equal(minimumEvidenceLabel(true, 507), "Met · 507 words");
  assert.equal(minimumEvidenceLabel(false, 341), "Not reached · 341 words");
});

test("Open uses the existing evidence API and the table does not render the essay", async () => {
  const page = await readFile(new URL("src/views/knowledge-reports.tsx", root), "utf8");
  const table = page.slice(page.indexOf("knowledge-report-cohort"), page.indexOf("knowledge-report-detail"));
  assert.match(page, /list_hub_learning_result_evidence/);
  assert.match(page, /list_knowledge_report_cohort/);
  assert.match(page, /data-testid="knowledge-report-text"/);
  assert.match(page, /Work Produced During Standard Time/);
  assert.match(page, /Final Submitted Work/);
  assert.match(page, /Back to cohort/);
  assert.match(page, /!selected && !loading && !error && visible.length > 0/);
  assert.match(table, /Extra time/);
  const model = await readFile(new URL("src/results/knowledge-reports.ts", root), "utf8");
  assert.match(model, /Not recorded/);
  assert.match(page, /knowledgeReportDetailFacts/);
  assert.doesNotMatch(table, /reportText/);
  assert.equal(
    reportTextFromEvidence([{ response_payload: { text: "First paragraph.\n\nSecond paragraph." } }]),
    "First paragraph.\n\nSecond paragraph.",
  );
  const submitted = DEMO_KNOWLEDGE_REPORTS.find((row) => row.studentNumber === "STUDENT-A");
  assert.equal(canOpenReport(submitted!), true);
});

test("the review form is feedback only", async () => {
  const page = await readFile(new URL("src/views/knowledge-reports.tsx", root), "utf8");
  assert.match(page, /review_knowledge_report/);
  assert.match(page, /Feedback \/ notes/);
  assert.match(page, /Mark as reviewed/);
  assert.doesNotMatch(page, /is_correct|awarded_score|Correct or incorrect|Pass\/fail/i);
  assert.doesNotMatch(page, /Needs additional support|Fail|Failed|Poor|Below ability/);
});

test("legacy 1.0.0 rows stay unrecorded and 1.1.0 rows keep the two-phase evidence", () => {
  const legacy = mapKnowledgeReportRow({
    student_id: "legacy",
    learner_name: "Cyber Smoke",
    completion_status: "submitted",
    word_count: 507,
    submission_method: "manual",
  });
  assert.equal(legacy.wordCount, 507);
  assert.equal(legacy.standardTimeWordCount, null);
  assert.equal(legacy.additionalTimeEligible, null);
  assert.equal(legacy.additionalTimeStarted, null);
  assert.equal(legacy.additionalTimeUsedSeconds, null);
  assert.equal(legacy.wordsAdded, null);
  assert.equal(extraTimeLabel(legacy), "—");
  assert.notEqual(legacy.standardTimeWordCount, 0);
  assert.notEqual(legacy.wordsAdded, 0);

  const current = mapKnowledgeReportRow({
    student_id: "current",
    learner_name: "Current learner",
    completion_status: "submitted",
    word_count: 420,
    standard_time_word_count: 348,
    additional_time_eligible: true,
    additional_time_started: true,
    additional_time_used_seconds: 900,
    words_added: 72,
    submission_method: "additional_time_expired",
  });
  assert.equal(current.standardTimeWordCount, 348);
  assert.equal(current.wordCount, 420);
  assert.equal(current.wordsAdded, 72);
  assert.equal(extraTimeLabel(current), "+15 min");
  assert.equal(mapKnowledgeReportRow({ additional_time_threshold_words: 400 }).additionalTimeThresholdWords, 400);
  assert.equal(mapKnowledgeReportRow({}).additionalTimeThresholdWords, null);
  assert.equal(mapKnowledgeReportRow({}).additionalTimeAllowanceSeconds, null);
});

test("the student PDF uses submitted evidence and ignores unfinished drafts", async () => {
  const page = await readFile(new URL("src/views/knowledge-reports.tsx", root), "utf8");
  assert.match(page, /list_hub_learning_result_evidence/);
  assert.match(page, /p_student_number: row\.studentNumber/);
  assert.match(page, /p_assignment_id: row\.assignmentId/);
  assert.match(page, /frozenEvidenceFromResponse/);
  assert.match(page, /if \(!canOpenReport\(row\)\) return/);
  assert.doesNotMatch(page, /state_payload|get_activity_state/);
  const frozen = frozenEvidenceFromResponse([
    { state_payload: { responses: { report: "unfinished draft text" } } },
    {
      response_payload: {
        text: "frozen final report",
        standardTimeText: "immutable standard snapshot",
        standardEndedAt: "2026-10-01T10:00:00.000Z",
      },
    },
  ]);
  assert.equal(frozen.reportText, "frozen final report");
  assert.equal(frozen.standardTimeText, "immutable standard snapshot");
  assert.equal(JSON.stringify(frozen).includes("unfinished draft text"), false);
  assert.equal(canOpenReport({ responseId: null, completionStatus: "in_progress" }), false);
});

test("stored 1.1.0 evidence keeps its values and legacy evidence stays unrecorded", () => {
  const current = mapKnowledgeReportRow({
    learner_name: "Learner A",
    group_name: "Group One",
    report_title: "Cyber Security Knowledge Report",
    completion_status: "submitted",
    word_count: 408,
    minimum_words: 500,
    minimum_met: false,
    duration_seconds: 1800,
    submission_method: "additional_time_expired",
    standard_time_word_count: 285,
    additional_time_eligible: true,
    additional_time_started: true,
    additional_time_used_seconds: 900,
    words_added: 123,
    additional_time_threshold_words: 400,
    additional_time_allowance_seconds: 900,
  });
  const payload = {
    text: "Final paragraph.\n\nSecond paragraph.",
    standardTimeText: "Standard paragraph.",
    wordCount: 408,
    minimumMet: false,
    standardTimeWordCount: 285,
    additionalTimeEligible: true,
    additionalTimeOffered: true,
    additionalTimeStarted: true,
    additionalTimeUsedSeconds: 900,
    additionalTimeSeconds: 900,
    wordsAddedDuringAdditionalTime: 123,
    durationSeconds: 1800,
    submissionMethod: "additional_time_expired",
  };
  const before = structuredClone(payload);
  const frozen = frozenEvidenceFromResponse([{ response_payload: payload }]);
  assert.deepEqual(payload, before);
  assert.equal(distinctStandardTimeText(frozen.standardTimeText, frozen.reportText), "Standard paragraph.");
  assert.equal(distinctStandardTimeText(frozen.reportText, frozen.reportText), null);
  const facts = Object.fromEntries(knowledgeReportDetailFacts(current, frozen).map((fact) => [fact.label, fact.value]));
  assert.equal(facts["Learner"], "Learner A");
  assert.equal(facts["Words after standard time"], "285");
  assert.equal(facts["Standard time allowed"], "30 minutes");
  assert.equal(facts["Internal evidence threshold"], "400 words");
  assert.equal(facts["Internal evidence threshold result"], "Not reached");
  assert.equal(facts["Additional time offered"], "Yes");
  assert.equal(facts["Actual additional-time duration used"], "15 minutes");
  assert.equal(facts["Net word-count change during additional time"], "+123");
  assert.equal(facts["Final word count"], "408");
  assert.equal(facts["500-word student target result"], "Not reached");
  assert.equal(facts["Submission method"], "Additional time expired");

  const legacy = mapKnowledgeReportRow({
    learner_name: "Legacy Learner",
    completion_status: "submitted",
    word_count: 507,
    minimum_words: 500,
    minimum_met: true,
    duration_seconds: 1800,
    elapsed_seconds: 1457,
    submission_method: "manual",
  });
  const legacyFrozen = frozenEvidenceFromResponse([{
    response_payload: {
      text: "Legacy essay.",
      wordCount: 507,
      minimumMet: true,
      elapsedSeconds: 1457,
      durationSeconds: 1800,
      submissionMethod: "manual",
    },
  }]);
  const legacyFacts = Object.fromEntries(knowledgeReportDetailFacts(legacy, legacyFrozen).map((fact) => [fact.label, fact.value]));
  assert.equal(legacyFacts["Final word count"], "507");
  assert.equal(legacyFacts["Submission method"], "Manual");
  assert.equal(legacyFacts["Words after standard time"], "Not recorded");
  assert.equal(legacyFacts["Internal evidence threshold result"], "Not recorded");
  assert.equal(legacyFacts["Additional time offered"], "Not recorded");
  assert.equal(legacyFacts["Additional time used"], "Not recorded");
  assert.equal(legacyFacts["Actual additional-time duration used"], "Not recorded");
  assert.equal(legacyFacts["Net word-count change during additional time"], "Not recorded");
  assert.equal(legacyFrozen.standardTimeText, null);
  assert.equal(legacyFrozen.additionalTimeUsedSeconds, null);
  assert.notEqual(legacyFrozen.additionalTimeUsedSeconds, 0);
  assert.notEqual(legacyFacts["Internal evidence threshold result"], "Achieved");
  assert.notEqual(legacyFacts["Internal evidence threshold result"], "Not reached");
});
