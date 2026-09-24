import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resultSourceById } from "../src/results/result-sources.ts";
import {
  DEMO_KNOWLEDGE_REPORTS,
  canOpenReport,
  filterKnowledgeReports,
  formatElapsed,
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
  assert.equal(minimumEvidenceLabel(true, 507), "Met · 507 words");
  assert.equal(minimumEvidenceLabel(false, 341), "Not reached · 341 words");
});

test("Open uses the existing evidence API and the table does not render the essay", async () => {
  const page = await readFile(new URL("src/views/knowledge-reports.tsx", root), "utf8");
  const table = page.slice(page.indexOf("knowledge-report-cohort"), page.indexOf("knowledge-report-detail"));
  assert.match(page, /list_hub_learning_result_evidence/);
  assert.match(page, /list_knowledge_report_cohort/);
  assert.match(page, /data-testid="knowledge-report-text"/);
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
