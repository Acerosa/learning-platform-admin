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

function textBaselines(drawn: string): number[] {
  return [...drawn.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g)].map((match) => Number(match[1]));
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
  assert.match(text, /completed the report within the standard task period, producing 436 words/);
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
  assert.match(text, /Allowed: 15:00/);
  assert.match(text, /Actually used: 15:00/);
  assert.match(text, /Total working time: 45:00/);
  assert.match(text, /Submitted when additional time expired/);
  assert.match(text, /Net words added during additional time: \+126/);
  assert.match(text, /Final word count: 474/);
  assert.match(text, /Total working time: 45 minutes/);
  assert.match(text, /final submission increasing to 474 words/);
  assert.match(text, /STANDARD-TIME EVIDENCE · 30:00 · 348 WORDS/);
  assert.match(text, /FINAL EVIDENCE · 474 WORDS · \+126 WORDS AFTER ADDITIONAL TIME/);
  assert.match(text, /AFTER ADDITIONAL TIME/);
  assert.match(text, /does not represent individual keystrokes/);
  assert.doesNotMatch(text, /Additional-Time Evidence/);
  assert.match(text, /Work Produced During Standard Task Time/);
  assert.match(text, /First 30 minutes/);
  assert.match(text, /Standard paragraph one\.\n\nStandard paragraph two\./);
  assert.match(text, /Final Submitted Work/);
  assert.match(text, /Added during additional time/);
  assert.match(text, /Net word-count change: \+126/);
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
  assert.match(text, /submitted 523 words after 24 minutes and 18 seconds, within the standard task period/);
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
    assert.match(drawn, new RegExp(`Page ${page} of ${pdf.getPageCount()}(?!\\d)`));
  }
  assert.match(drawn, /NHC \| Cyber Security Knowledge Report \| Alex Example/);
  const positions = textBaselines(drawn);
  const contentBaselines = positions.filter((y) => y > 40);
  assert.ok(contentBaselines.length > 0);
  assert.ok(Math.min(...contentBaselines) >= 60, `content entered the footer at y=${Math.min(...contentBaselines)}`);
  assert.match(drawn, /STANDARD-END-MARKER/);
  assert.match(drawn, /FINAL-END-MARKER/);
  assert.ok(drawn.indexOf("STANDARD-END-MARKER") < drawn.indexOf("FINAL-END-MARKER"));
  assert.doesNotMatch(text, /Reviewed by:/);
});

test("additional-time evidence shows both stored writings and the real used time", async () => {
  const standard = "The standard-time writing stays exactly as stored.\n\nSecond standard paragraph.";
  const finalText = `${standard}\n\nWords added after the standard period.`;
  const row = reportRow({
    learnerName: "Additional Learner",
    wordCount: 455,
    standardTimeWordCount: 335,
    minimumMet: false,
    elapsedSeconds: 1800,
    additionalTimeEligible: true,
    additionalTimeStarted: true,
    additionalTimeUsedSeconds: 8 * 60 + 42,
    wordsAdded: 120,
    submissionMethod: "additional_time_expired",
  });
  const source = {
    row,
    reportText: finalText,
    standardTimeText: standard,
    standardEndedAt: "2026-10-01T10:00:00.000Z",
    additionalTimeStartedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  };
  const before = structuredClone(source);
  const text = individualReportText(source);
  const bytes = await buildIndividualKnowledgeReportPdf(source);
  assert.deepEqual(source, before);
  assert.match(text, /STANDARD TASK TIME/);
  assert.match(text, /ADDITIONAL TIME/);
  assert.match(text, /FINAL OUTCOME/);
  assert.match(text, /30:00/);
  assert.match(text, /335 words/);
  assert.match(text, /Allowed: 15:00/);
  assert.match(text, /Actually used: 08:42/);
  assert.doesNotMatch(text, /Actually used: 15:00/);
  assert.match(text, /Words added: \+120/);
  assert.match(text, /Total working time: 38:42/);
  assert.match(text, /Internal evidence threshold: 400 words — Not reached/);
  assert.match(text, /Additional time allowed: 15 minutes/);
  assert.match(text, /Actual additional time used: 08:42/);
  assert.match(text, /Net word-count change: \+120/);
  assert.match(text, /Final word count: 455/);
  assert.match(text, /STANDARD-TIME EVIDENCE · 30:00 · 335 WORDS/);
  assert.match(text, /FINAL EVIDENCE · 455 WORDS · \+120 WORDS AFTER ADDITIONAL TIME/);
  assert.match(text, /AFTER ADDITIONAL TIME/);
  assert.match(text, /does not represent individual keystrokes/);
  assert.doesNotMatch(text, /Additional-Time Evidence/);
  assert.match(text, /Work Produced During Standard Task Time/);
  assert.match(text, /30 minutes \| 335 words/);
  assert.match(text, /Final: 455 words \| Additional time used: 08:42/);
  assert.match(text, /The standard-time writing stays exactly as stored\.\n\nSecond standard paragraph\./);
  assert.match(text, /Words added after the standard period\./);
  assert.equal(text.split("The standard-time writing stays exactly as stored.").length - 1, 2);
  assert.match(text, /final submission increasing to 455 words/);
  assert.doesNotMatch(text, /Needs support|SEN|Access arrangement|\bPass\b|\bFail\b/);
  const drawn = pdfPlainText(bytes);
  const pdf = await PDFDocument.load(bytes);
  assert.match(drawn, /The standard-time writing stays exactly as stored/);
  assert.match(drawn, /Words added after the standard period/);
  assert.match(drawn, /08:42/);
  assert.match(drawn, /Internal evidence threshold/);
  assert.match(drawn, /Not reached/);
  for (let page = 1; page <= pdf.getPageCount(); page += 1) {
    assert.match(drawn, new RegExp(`Page ${page} of ${pdf.getPageCount()}(?!\\d)`));
  }
});

test("standard-time completion prints the stored essay once", async () => {
  const essayText = "The completed standard-time essay.\n\nIt has a second paragraph with it's own apostrophe.";
  const row = reportRow({
    wordCount: 435,
    standardTimeWordCount: 435,
    minimumMet: false,
    elapsedSeconds: 1800,
    additionalTimeEligible: false,
    additionalTimeStarted: false,
    additionalTimeUsedSeconds: null,
    wordsAdded: null,
    submissionMethod: "standard_time_complete",
  });
  const text = individualReportText({
    row,
    reportText: essayText,
    standardTimeText: essayText,
    standardEndedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  assert.match(text, /435 words \| Completed within standard task time/);
  assert.match(text, /Internal evidence threshold: 400 words — Achieved/);
  assert.match(text, /Additional time used: No/);
  assert.equal(text.split(essayText).length - 1, 1);
  assert.doesNotMatch(text, /Work Produced During Standard Time/);
  assert.doesNotMatch(text, /Additional time used: 15:00|Actual additional time used/);
  const bytes = await buildIndividualKnowledgeReportPdf({
    row,
    reportText: essayText,
    standardTimeText: essayText,
    standardEndedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  const drawn = pdfPlainText(bytes);
  assert.equal(drawn.split("The completed standard-time essay.").length - 1, 1);
  assert.match(drawn, /Completed within standard task time/);
  assert.doesNotMatch(drawn, /Work Produced During Standard Time/);
});

test("an early manual submission records the elapsed time and one essay", async () => {
  const essayText = "The early 500-word submission is the only stored writing.";
  const row = reportRow({
    wordCount: 575,
    minimumMet: true,
    elapsedSeconds: 24 * 60 + 18,
    submissionMethod: "manual",
    standardTimeWordCount: 575,
    additionalTimeEligible: false,
    additionalTimeStarted: false,
  });
  const text = individualReportText({
    row,
    reportText: essayText,
    standardTimeText: null,
    standardEndedAt: null,
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  assert.match(text, /575 words \| Submitted after 24:18/);
  assert.match(text, /Actual working time: 24:18/);
  assert.equal(text.split(essayText).length - 1, 1);
  assert.doesNotMatch(text, /Work Produced During Standard Time/);
  assert.doesNotMatch(text, /Words after standard time/);
  assert.doesNotMatch(text, /Internal evidence threshold/);
  assert.doesNotMatch(text, /Additional time used: 15|Additional time offered/);
  const drawn = pdfPlainText(await buildIndividualKnowledgeReportPdf({
    row,
    reportText: essayText,
    standardTimeText: null,
    standardEndedAt: null,
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  }));
  assert.match(drawn, /SUBMITTED AFTER 24:18/);
  assert.match(drawn, /The early 500-word submission is the only stored writing/);
  assert.equal(drawn.split("The early 500-word submission is the only stored writing").length - 1, 1);
  assert.doesNotMatch(drawn, /Work Produced During Standard Time|Internal evidence threshold/);
});

test("legacy 1.0.0 writing is shown and two-phase fields stay unrecorded", async () => {
  const legacyEssay = "Legacy submission text that was stored before two-phase evidence.\n\nSecond legacy paragraph.";
  const row = DEMO_KNOWLEDGE_REPORTS[0];
  const before = structuredClone(row);
  const text = individualReportText({
    row,
    reportText: legacyEssay,
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  });
  assert.deepEqual(row, before);
  assert.match(text, /Additional time: not recorded for this attempt/);
  assert.match(text, /Legacy submission text that was stored before two-phase evidence\.\n\nSecond legacy paragraph\./);
  assert.equal(text.split(legacyEssay).length - 1, 1);
  assert.doesNotMatch(text, /Internal evidence threshold|Words after standard time|Additional time offered|Additional time used: Yes/);
  const drawn = pdfPlainText(await buildIndividualKnowledgeReportPdf({
    row,
    reportText: legacyEssay,
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: null,
    generatedAt,
  }));
  assert.match(drawn, /not recorded for this attempt/);
  assert.match(drawn, /Legacy submission text that was stored before two-phase evidence/);
  assert.match(drawn, /Second legacy paragraph/);
  assert.doesNotMatch(drawn, /Internal evidence threshold|Words after standard time/);
});

test("awkward learner punctuation and a long URL still render without changing the stored text", async () => {
  const stored = "It's a \"quoted\" (note) — see the link.\n\n- first point\n\nhttps://example.com/a-very-long-unbroken-url-that-must-wrap-inside-the-margin-url-end-marker";
  const curly = stored.replace("It's", "It\u2019s").replace("\"quoted\"", "\u201Cquoted\u201D");
  const row = reportRow({ wordCount: 435, standardTimeWordCount: 435 });
  const input = {
    row,
    reportText: curly,
    standardTimeText: curly,
    standardEndedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: null,
    reviewedBy: "  ",
    generatedAt,
  };
  const before = structuredClone(input);
  const bytes = await buildIndividualKnowledgeReportPdf(input);
  assert.deepEqual(input, before);
  assert.match(input.reportText, /\u2019/);
  const text = individualReportText(input);
  assert.match(text, /\u2019/);
  assert.doesNotMatch(text, /Reviewed by:/);
  const drawn = pdfPlainText(bytes);
  assert.match(drawn, /quoted/);
  assert.match(drawn, /url-end-marker/);
  assert.match(drawn, /first point/);
});

function pdfPageTexts(bytes: Uint8Array): string[] {
  const source = Buffer.from(bytes).toString("latin1");
  const pages: string[] = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const raw = Buffer.from(match[1], "latin1");
    let text = "";
    try {
      text = inflateSync(raw).toString("latin1");
    } catch {
      text = raw.toString("latin1");
    }
    const decoded = text.replace(/<([0-9A-Fa-f\s]+)>/g, (_hexMatch, hex: string) => (
      Buffer.from(hex.replace(/\s+/g, ""), "hex").toString("latin1")
    ));
    if (decoded.includes("Tm")) pages.push(decoded);
  }
  return pages;
}

function placedLines(stream: string): Array<{ x: number; y: number; text: string }> {
  return [...stream.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm\s+([\s\S]*?)\s*Tj/g)].map((match) => {
    const body = match[3].trim();
    const text = body.startsWith("<") && body.endsWith(">")
      ? Buffer.from(body.slice(1, -1).replace(/\s+/g, ""), "hex").toString("latin1")
      : body.startsWith("(") && body.endsWith(")")
        ? body.slice(1, -1).replace(/\\([()\\])/g, "$1")
        : body;
    return { x: Number(match[1]), y: Number(match[2]), text };
  });
}

test("the discussion acknowledgement keeps blank signature lines and states the report purpose", async () => {
  const input = {
    row: reportRow({ learnerName: "Alex Example" }),
    reportText: "Stored writing.",
    standardTimeText: "Stored writing.",
    standardEndedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: "Clear structure.",
    reviewedBy: "Synthetic Teacher",
    generatedAt,
  };
  const before = structuredClone(input);
  const text = individualReportText(input);
  const bytes = await buildIndividualKnowledgeReportPdf(input);
  assert.deepEqual(input, before);
  assert.match(text, /Purpose: This report records evidence from the learner's timed Knowledge Report/);
  assert.match(text, /alongside other evidence when discussing whether further support or additional time may be appropriate/);
  assert.match(text, /This analysis assists staff review\. It is not an assessment or support decision\./);
  assert.match(text, /Student Discussion and Acknowledgement/);
  assert.match(text, /This report has been discussed with the student\. The student has had the opportunity to review the evidence recorded from their timed Knowledge Report\./);
  assert.match(text, /Student name: Alex Example/);
  assert.match(text, /Student signature: _+/);
  assert.match(text, /Staff name: Synthetic Teacher/);
  assert.match(text, /Staff signature: _+/);
  assert.equal((text.match(/Date: _+/g) ?? []).length, 2);
  assert.match(text, /Comments \(optional\)/);
  assert.equal((text.match(/_{20,}/g) ?? []).length >= 3, true);
  const acknowledgement = text.slice(text.indexOf("Student Discussion and Acknowledgement"));
  assert.doesNotMatch(acknowledgement, /I agree|need support|needs support|SEN|access arrangement|passed|failed|\bPass\b|\bFail\b/i);
  assert.doesNotMatch(acknowledgement, /agree that they need additional time|agree they need additional time|need additional time/i);
  assert.doesNotMatch(acknowledgement, /Student signature:\s*[A-Za-z]/);
  assert.doesNotMatch(acknowledgement, /Staff signature:\s*[A-Za-z]/);
  assert.doesNotMatch(acknowledgement, /Date:\s*[A-Za-z0-9]/);

  const unnamed = individualReportText({
    ...input,
    row: reportRow({ learnerName: "" }),
  });
  const unnamedAcknowledgement = unnamed.slice(unnamed.indexOf("Student Discussion and Acknowledgement"));
  assert.match(unnamedAcknowledgement, /Student name: _+/);
  assert.doesNotMatch(unnamedAcknowledgement, /Student name:\s*[A-Za-z]/);
  const unsignedStaff = individualReportText({
    ...input,
    reviewedBy: "  ",
  });
  const unsignedAcknowledgement = unsignedStaff.slice(unsignedStaff.indexOf("Student Discussion and Acknowledgement"));
  assert.match(unsignedAcknowledgement, /Staff name: _+/);
  assert.doesNotMatch(unsignedAcknowledgement, /Staff name:\s*[A-Za-z]/);

  const pages = pdfPageTexts(bytes);
  const signaturePage = pages.find((page) => page.includes("Student Discussion and Acknowledgement"));
  assert.ok(signaturePage);
  for (const label of ["Student signature:", "Staff signature:", "Student name:", "Staff name:", "Comments (optional)"]) {
    assert.match(signaturePage, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal((signaturePage.match(/Date:/g) ?? []).length, 2);
  const placed = placedLines(signaturePage);
  const studentNameLine = placed.find((item) => item.text.startsWith("Student name:"));
  const staffNameLine = placed.find((item) => item.text.startsWith("Staff name:"));
  const studentSignature = placed.find((item) => item.text.startsWith("Student signature:"));
  const staffSignature = placed.find((item) => item.text.startsWith("Staff signature:"));
  const dateLines = placed.filter((item) => item.text === "Date:");
  const commentLines = placed.filter((item) => item.text.startsWith("_") && item.x < 80 && item.text.length >= 50);
  assert.ok(studentNameLine);
  assert.ok(staffNameLine);
  assert.ok(studentSignature);
  assert.ok(staffSignature);
  assert.equal(dateLines.length, 2);
  assert.ok(Math.abs(studentSignature.y - staffSignature.y) < 1);
  assert.ok(Math.abs(studentNameLine.y - staffNameLine.y) < 1);
  assert.ok(Math.abs(dateLines[0].y - dateLines[1].y) < 1);
  assert.ok(studentSignature.x < staffSignature.x);
  const signatureRules = placed.filter((item) => item.text.startsWith("_") && Math.abs(item.y - (studentSignature.y - 36)) < 1.5);
  assert.equal(signatureRules.length, 2);
  assert.ok(studentSignature.y - signatureRules[0].y >= 32);
  assert.ok(signatureRules.every((item) => item.y > dateLines[0].y));
  assert.equal(commentLines.length, 3);
  const commentYs = commentLines.map((item) => item.y).sort((left, right) => right - left);
  assert.ok(commentYs[0] < dateLines[0].y);
  assert.ok(commentYs[0] - commentYs[1] >= 20);
  assert.ok(commentYs[1] - commentYs[2] >= 20);
  const lowest = Math.min(...commentYs);
  assert.ok(lowest >= 60, `signature block entered the footer at y=${lowest}`);
  assert.match(signaturePage, /_{20,}/);
  assert.equal(pages.filter((page) => page.includes("Student signature:")).length, 1);
});

test("a long report keeps the signature block together on a following page", async () => {
  const paragraph = "The learner kept writing about confidentiality, integrity and availability. ";
  const finalText = `${paragraph.repeat(160)}\n\nFINAL-END-MARKER`;
  const bytes = await buildIndividualKnowledgeReportPdf({
    row: reportRow({
      wordCount: 900,
      standardTimeWordCount: 420,
      additionalTimeEligible: true,
      additionalTimeStarted: true,
      additionalTimeUsedSeconds: 900,
      wordsAdded: 480,
      submissionMethod: "additional_time_expired",
    }),
    reportText: finalText,
    standardTimeText: `${paragraph.repeat(40)}\n\nSTANDARD-END-MARKER`,
    standardEndedAt: "2026-10-01T10:30:00.000Z",
    additionalTimeStartedAt: "2026-10-01T10:30:00.000Z",
    contentReview: null,
    teacherFeedback: "Reviewed the full writing.",
    reviewedBy: "Synthetic Teacher",
    generatedAt,
  });
  const pages = pdfPageTexts(bytes);
  const index = pages.findIndex((page) => page.includes("Student Discussion and Acknowledgement"));
  assert.ok(index > 0, "signature block stayed on the first page");
  const signaturePage = pages[index];
  const previousPage = pages[index - 1];
  assert.match(previousPage, /Teacher Review|FINAL-END-MARKER/);
  assert.doesNotMatch(previousPage, /Student signature:/);
  assert.match(signaturePage, /Student signature:/);
  assert.match(signaturePage, /Staff signature:/);
  assert.equal((signaturePage.match(/Date:/g) ?? []).length, 2);
  assert.match(signaturePage, /Comments \(optional\)/);
  assert.doesNotMatch(signaturePage, /FINAL-END-MARKER/);
  const placed = placedLines(signaturePage);
  const heading = placed.find((item) => item.text.includes("Student Discussion and Acknowledgement"));
  const studentSignature = placed.find((item) => item.text.startsWith("Student signature:"));
  const staffSignature = placed.find((item) => item.text.startsWith("Staff signature:"));
  const dateLines = placed.filter((item) => item.text === "Date:");
  const commentLines = placed.filter((item) => item.text.startsWith("_") && item.x < 80 && item.text.length >= 50);
  assert.ok(heading);
  assert.ok(studentSignature && staffSignature);
  assert.ok(Math.abs(studentSignature.y - staffSignature.y) < 1);
  assert.equal(dateLines.length, 2);
  assert.equal(commentLines.length, 3);
  assert.ok(dateLines.every((item) => item.y < studentSignature.y));
  assert.ok(commentLines.every((item) => item.y < dateLines[0].y));
  assert.equal(pages.filter((page) => page.includes("Student signature:")).length, 1);
  assert.doesNotMatch(previousPage, /Student signature:|Comments \(optional\)/);
  const contentYs = placed.map((item) => item.y).filter((y) => y > 40);
  assert.ok(Math.min(...contentYs) >= 60, `signature block entered the footer at y=${Math.min(...contentYs)}`);
});
