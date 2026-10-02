import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { DEMO_KNOWLEDGE_REPORTS, DEMO_KNOWLEDGE_REPORT_TEXT, type KnowledgeReportRow } from "../src/results/knowledge-reports.ts";
import {
  buildCohortKnowledgeReportPdf,
  buildIndividualKnowledgeReportPdf,
  cohortCounts,
  cohortReportText,
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

test("individual PDFs keep 1.0.0 evidence unrecorded and show 1.1.0 timing", () => {
  const legacy = DEMO_KNOWLEDGE_REPORTS[0];
  const legacyText = individualReportText({
    row: legacy,
    reportText: essay,
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt: new Date("2026-09-24T12:00:00Z"),
  });
  assert.match(legacyText, /Additional time: not recorded for this attempt/);
  assert.doesNotMatch(legacyText, /Words after standard time: 0/);
  assert.match(legacyText, /684/);

  const current: KnowledgeReportRow = {
    ...legacy,
    learnerName: "Current learner",
    wordCount: 420,
    standardTimeWordCount: 348,
    additionalTimeEligible: true,
    additionalTimeStarted: true,
    additionalTimeUsedSeconds: 900,
    wordsAdded: 72,
    submissionMethod: "additional_time_expired",
  };
  const currentText = individualReportText({
    row: current,
    reportText: "The final accepted report.",
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt: new Date("2026-10-01T12:00:00Z"),
  });
  assert.match(currentText, /Words after standard time: 348/);
  assert.match(currentText, /Final word count: 420/);
  assert.match(currentText, /Net words added during additional time: \+72/);
  assert.match(currentText, /Additional time expired/);
  assert.match(currentText, /The final accepted report/);
});

test("a cohort PDF keeps mixed 1.0.0 and 1.1.0 attempts distinct", () => {
  const legacy = DEMO_KNOWLEDGE_REPORTS[0];
  const current: KnowledgeReportRow = {
    ...legacy,
    learnerName: "Current learner",
    studentNumber: "STUDENT-NEW",
    wordCount: 420,
    standardTimeWordCount: 348,
    additionalTimeEligible: true,
    additionalTimeStarted: true,
    additionalTimeUsedSeconds: 900,
    wordsAdded: 72,
    submissionMethod: "additional_time_expired",
    minimumMet: false,
  };
  const offered: KnowledgeReportRow = {
    ...legacy,
    learnerName: "Offered learner",
    studentNumber: "STUDENT-OFFER",
    completionStatus: "submitted",
    wordCount: 390,
    standardTimeWordCount: 390,
    additionalTimeEligible: true,
    additionalTimeStarted: false,
    additionalTimeUsedSeconds: null,
    wordsAdded: null,
    submissionMethod: "standard_time_complete",
    minimumMet: false,
  };
  const rows = [legacy, current, offered];
  const counts = cohortCounts(rows);
  assert.equal(counts.additionalTimeEligible, 2);
  assert.equal(counts.additionalTimeUsed, 1);
  assert.equal(counts.completedInStandardTime, 1);
  const text = cohortReportText({
    title: "Cyber Security Knowledge Report",
    groupLabel: "CYBER-TEST-A",
    rows,
    generatedAt: new Date("2026-10-01T12:00:00Z"),
  });
  assert.match(text, /Current learner \| 420/);
  assert.match(text, /\+15 min/);
  assert.match(text, /Offered learner \| 390/);
  assert.match(text, /Offered/);
  assert.match(text, /—/);
  assert.doesNotMatch(text, /Needs support|Extra time required/);
});

const generatedAt = new Date("2026-10-01T18:00:00Z");

function reportRow(patch: Partial<KnowledgeReportRow>): KnowledgeReportRow {
  return {
    ...DEMO_KNOWLEDGE_REPORTS[0],
    learnerName: "Alex Example",
    groupName: "Cyber Test A",
    reportTitle: "Cyber Security Knowledge Report",
    submittedAt: "2026-10-01T10:30:00.000Z",
    durationSeconds: 1800,
    minimumWords: 500,
    elapsedSeconds: 1800,
    wordCount: 436,
    minimumMet: false,
    submissionMethod: "standard_time_complete",
    standardTimeWordCount: 436,
    additionalTimeEligible: false,
    additionalTimeStarted: false,
    additionalTimeUsedSeconds: null,
    wordsAdded: null,
    additionalTimeThresholdWords: 400,
    additionalTimeAllowanceSeconds: 900,
    ...patch,
  };
}

function pdfPlainText(bytes: Uint8Array): string {
  const source = Buffer.from(bytes).toString("latin1");
  const parts: string[] = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Buffer.from(match[1], "latin1");
    try {
      parts.push(inflateSync(raw).toString("latin1"));
    } catch {
      parts.push(raw.toString("latin1"));
    }
  }
  return parts.join("\n").replace(/<([0-9A-Fa-f\s]+)>/g, (_match, hex: string) => (
    Buffer.from(hex.replace(/\s+/g, ""), "hex").toString("latin1")
  ));
}

test("standard-time completion shows the threshold and does not duplicate the essay", () => {
  const essayText = "The standard-time report stays the final report.\n\nSecond paragraph.";
  const text = individualReportText({
    row: reportRow({}),
    reportText: essayText,
    standardTimeText: essayText,
    standardEndedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  assert.match(text, /Individual Student Evidence Report/);
  assert.match(text, /Subject: Cyber Security/);
  assert.match(text, /Student: Alex Example/);
  assert.match(text, /Standard time allowed: 30 minutes/);
  assert.match(text, /Words after standard time: 436/);
  assert.match(text, /Standard-time threshold: 400 words/);
  assert.match(text, /Threshold result: Achieved/);
  assert.match(text, /Additional time offered: No/);
  assert.match(text, /Additional time used: No/);
  assert.match(text, /Final word count: 436/);
  assert.match(text, /Student-facing target: 500 words/);
  assert.match(text, /Final target: Not reached/);
  assert.match(text, /achieved the standard-time threshold/);
  assert.match(text, /Final Submitted Work/);
  assert.equal(text.split(essayText).length - 1, 1);
  assert.doesNotMatch(text, /Work Produced During Standard Time/);
  assert.doesNotMatch(text, /\b(Pass|Fail|Passed|Failed|Needs support|Does not need support)\b/);
});

test("additional time includes both the immutable snapshot and the final report", () => {
  const standard = "Standard paragraph one.\n\nStandard paragraph two.";
  const finalText = "Standard paragraph one.\n\nStandard paragraph two.\n\nAdded during additional time.";
  const text = individualReportText({
    row: reportRow({
      wordCount: 474,
      standardTimeWordCount: 348,
      minimumMet: false,
      additionalTimeEligible: true,
      additionalTimeStarted: true,
      additionalTimeUsedSeconds: 900,
      wordsAdded: 126,
      elapsedSeconds: 1800,
      submissionMethod: "additional_time_expired",
    }),
    reportText: finalText,
    standardTimeText: standard,
    standardEndedAt: "2026-10-01T10:00:00.000Z",
    additionalTimeStartedAt: "2026-10-01T10:05:00.000Z",
    contentReview: {
      analysisVersion: "1",
      overallRelevance: "high",
      summary: "The response addresses the task.",
      topics: [{ key: "cia", label: "CIA Triad", coverage: "demonstrated", reason: "Named the three parts." }],
      repetitionFlag: false,
      repetitionNote: null,
    },
    teacherFeedback: "Compared both versions.",
    reviewedBy: "Synthetic Teacher",
    generatedAt,
  });
  assert.match(text, /Words after standard time: 348/);
  assert.match(text, /Threshold result: Not reached/);
  assert.match(text, /Additional time offered: Yes/);
  assert.match(text, /Additional time used: Yes/);
  assert.match(text, /Actual additional time used: 15 minutes/);
  assert.match(text, /Net words added during additional time: \+126/);
  assert.match(text, /Final word count: 474/);
  assert.match(text, /Total working time: 45 minutes/);
  assert.match(text, /net increase of 126 words/);
  assert.match(text, /Work Produced During Standard Time/);
  assert.match(text, /First 30 minutes/);
  assert.match(text, /Standard paragraph one\.\n\nStandard paragraph two\./);
  assert.match(text, /Final Submitted Work/);
  assert.match(text, /Added during additional time/);
  assert.match(text, /Additional-Time Evidence/);
  assert.match(text, /Net word-count change: \+126/);
  assert.match(text, /not a count of keystrokes/);
  assert.match(text, /CIA Triad — Demonstrated/);
  assert.match(text, /not an assessment or support decision/);
  assert.match(text, /Reviewed by: Synthetic Teacher/);
  assert.notEqual(text.indexOf(standard), text.indexOf("Added during additional time"));
});

test("an early 500-word submission shows the actual working time and no false snapshot", () => {
  const essayText = "The early final report.";
  const text = individualReportText({
    row: reportRow({
      wordCount: 523,
      minimumMet: true,
      elapsedSeconds: 24 * 60 + 18,
      submissionMethod: "manual",
      standardTimeWordCount: 523,
      additionalTimeEligible: false,
      additionalTimeStarted: false,
    }),
    reportText: essayText,
    standardTimeText: essayText,
    standardEndedAt: null,
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  assert.match(text, /Actual working time: 24:18/);
  assert.match(text, /Target reached: Achieved/);
  assert.match(text, /Additional time: Not required/);
  assert.match(text, /submitted after 24 minutes and 18 seconds/);
  assert.doesNotMatch(text, /Words after standard time/);
  assert.doesNotMatch(text, /Work Produced During Standard Time/);
  assert.doesNotMatch(text, /Additional time used: 15 minutes|Net words added/);
  assert.equal(text.split(essayText).length - 1, 1);
});

test("offered additional time that was not started has no invented duration or improvement", () => {
  const text = individualReportText({
    row: reportRow({
      wordCount: 352,
      standardTimeWordCount: 352,
      minimumMet: false,
      additionalTimeEligible: true,
      additionalTimeStarted: false,
      additionalTimeUsedSeconds: null,
      wordsAdded: null,
      submissionMethod: "standard_time_complete",
    }),
    reportText: "The snapshot is the final report.",
    standardTimeText: "The snapshot is the final report.",
    standardEndedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  assert.match(text, /Words after standard time: 352/);
  assert.match(text, /Threshold result: Not reached/);
  assert.match(text, /Additional time offered: Yes/);
  assert.match(text, /Additional time started: No/);
  assert.match(text, /did not start the additional time/);
  assert.doesNotMatch(text, /Actual additional time used/);
  assert.doesNotMatch(text, /Net words added during additional time/);
  assert.doesNotMatch(text, /Additional-Time Evidence/);
  assert.doesNotMatch(text, /Work Produced During Standard Time/);
});

test("a legacy 1.0.0 PDF does not invent two-phase values", () => {
  const text = individualReportText({
    row: DEMO_KNOWLEDGE_REPORTS[0],
    reportText: essay,
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  assert.match(text, /Additional time: not recorded for this attempt/);
  assert.match(text, /684/);
  assert.doesNotMatch(text, /Words after standard time: 0/);
  assert.doesNotMatch(text, /Additional time offered: No/);
  assert.doesNotMatch(text, /Net word-count change: 0|Net words added during additional time: 0/);
  assert.doesNotMatch(text, /Work Produced During Standard Time/);
});

test("a long report flows across pages without truncation and numbers every page", async () => {
  const paragraph = "The learner kept writing about confidentiality, integrity and availability. ";
  const standard = `${paragraph.repeat(80)}\n\nSTANDARD-END-MARKER`;
  const finalText = `${standard}\n\n${paragraph.repeat(80)}\n\nFINAL-END-MARKER`;
  const input = {
    row: reportRow({
      wordCount: 474,
      standardTimeWordCount: 348,
      additionalTimeEligible: true,
      additionalTimeStarted: true,
      additionalTimeUsedSeconds: 900,
      wordsAdded: 126,
      submissionMethod: "additional_time_expired",
    }),
    reportText: finalText,
    standardTimeText: standard,
    standardEndedAt: "2026-10-01T10:00:00.000Z",
    additionalTimeStartedAt: "2026-10-01T10:05:00.000Z",
    contentReview: null,
    teacherFeedback: "Reviewed the full writing.",
    reviewedBy: null,
    generatedAt,
  };
  const text = individualReportText(input);
  assert.match(text, /STANDARD-END-MARKER/);
  assert.match(text, /FINAL-END-MARKER/);
  assert.ok(text.indexOf("STANDARD-END-MARKER") < text.indexOf("FINAL-END-MARKER"));
  const bytes = await buildIndividualKnowledgeReportPdf(input);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
  const drawn = pdfPlainText(bytes);
  for (let page = 1; page <= pdf.getPageCount(); page += 1) {
    assert.match(drawn, new RegExp(`${page} / ${pdf.getPageCount()}`));
  }
  assert.match(drawn, /STANDARD-END-MARKER/);
  assert.match(drawn, /FINAL-END-MARKER/);
  assert.doesNotMatch(text, /Reviewed by:/);
});
