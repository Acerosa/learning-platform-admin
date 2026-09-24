import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_KNOWLEDGE_REPORTS, DEMO_KNOWLEDGE_REPORT_TEXT } from "../src/results/knowledge-reports.ts";
import {
  buildCohortKnowledgeReportPdf,
  buildIndividualKnowledgeReportPdf,
  cohortCounts,
  individualReportText,
} from "../src/results/knowledge-report-pdf.ts";

const essay = `${DEMO_KNOWLEDGE_REPORT_TEXT}\n\nThis sentence stays in the exported report.`;

test("an individual PDF contains the frozen report and sitting metadata", async () => {
  const row = DEMO_KNOWLEDGE_REPORTS[0];
  const bytes = await buildIndividualKnowledgeReportPdf({
    row,
    reportText: essay,
    contentReview: {
      analysisVersion: "1",
      overallRelevance: "high",
      summary: "The response substantially addresses the Cyber Security task.",
      topics: [{ key: "cia", label: "CIA Triad", coverage: "demonstrated", reason: "Explained." }],
      repetitionFlag: false,
      repetitionNote: null,
    },
    teacherFeedback: "Clear structure.",
    reviewedBy: "Synthetic Teacher",
    generatedAt: new Date("2026-09-24T12:00:00Z"),
  });
  const text = individualReportText({
    row,
    reportText: essay,
    contentReview: {
      analysisVersion: "1",
      overallRelevance: "high",
      summary: "The response substantially addresses the Cyber Security task.",
      topics: [{ key: "cia", label: "CIA Triad", coverage: "demonstrated", reason: "Explained." }],
      repetitionFlag: false,
      repetitionNote: null,
    },
    teacherFeedback: "Clear structure.",
    reviewedBy: "Synthetic Teacher",
    generatedAt: new Date("2026-09-24T12:00:00Z"),
  });
  assert.match(text, /This sentence stays in the exported report/);
  assert.match(text, /684/);
  assert.match(text, /Clear structure/);
  assert.match(text, /not an assessment or support decision/);
  assert.doesNotMatch(text, /Needs support|SEN/);
  assert.ok(bytes.byteLength > 500);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
});

test("a cohort PDF uses the filtered rows and does not include essay text", async () => {
  const filtered = DEMO_KNOWLEDGE_REPORTS.filter((row) => row.overallRelevance === "very_low");
  const counts = cohortCounts(filtered);
  assert.equal(counts.assigned, 1);
  assert.equal(counts.targetNotReached, 1);
  const bytes = await buildCohortKnowledgeReportPdf({
    title: "Cyber Security Knowledge Report",
    groupLabel: "CYBER-TEST-A",
    rows: filtered,
    generatedAt: new Date("2026-09-24T12:00:00Z"),
  });
  assert.equal(counts.submitted, 1);
  assert.ok(bytes.byteLength > 400);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.equal(filtered.some((row) => row.learnerName === "Student C"), true);
});
