import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import {
  CONTENT_REVIEW_ADVISORY,
  coverageLabel,
  extraTimeLabel,
  formatElapsed,
  minimumLabel,
  relevanceLabel,
  reviewLabel,
  submissionMethodLabel,
  type KnowledgeReportContentReview,
  type KnowledgeReportRow,
} from "./knowledge-reports.ts";

export interface IndividualKnowledgeReportPdf {
  row: KnowledgeReportRow;
  reportText: string;
  standardTimeText?: string | null;
  standardEndedAt?: string | null;
  additionalTimeStartedAt?: string | null;
  contentReview: KnowledgeReportContentReview | null;
  teacherFeedback: string | null;
  reviewedBy: string | null;
  generatedAt: Date;
}

export interface CohortKnowledgeReportPdf {
  title: string;
  groupLabel: string;
  rows: readonly KnowledgeReportRow[];
  generatedAt: Date;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

function breakWideWord(word: string, font: PDFFont, size: number, width: number): string[] {
  const pieces: string[] = [];
  let chunk = "";
  for (const char of word) {
    const next = chunk + char;
    if (font.widthOfTextAtSize(next, size) > width && chunk) {
      pieces.push(chunk);
      chunk = char;
    } else {
      chunk = next;
    }
  }
  if (chunk) pieces.push(chunk);
  return pieces;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const pieces = font.widthOfTextAtSize(word, size) > width
        ? breakWideWord(word, font, size, width)
        : [word];
      for (const piece of pieces) {
        const next = current ? `${current} ${piece}` : piece;
        if (font.widthOfTextAtSize(next, size) > width && current) {
          lines.push(current);
          current = piece;
        } else {
          current = next;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

async function documentWithLines(sections: readonly string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const width = PAGE_WIDTH - MARGIN * 2;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pages: PDFPage[] = [page];
  let y = PAGE_HEIGHT - MARGIN;

  function nextPage() {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  }

  function draw(text: string, size: number, usedFont: PDFFont) {
    for (const line of wrap(text, usedFont, size, width)) {
      if (y < MARGIN + 24) nextPage();
      page.drawText(line, { x: MARGIN, y, size, font: usedFont });
      y -= size + 4;
    }
  }

  for (const section of sections) {
    if (section.startsWith("title\n")) draw(section.slice(6), 16, bold);
    else if (section.startsWith("heading\n")) draw(section.slice(8), 13, bold);
    else draw(section.startsWith("body\n") ? section.slice(5) : section, 11, font);
    y -= 6;
  }

  pages.forEach((item, index) => {
    item.drawText(`${index + 1} / ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 40,
      y: 24,
      size: 9,
      font,
    });
  });
  return pdf.save();
}

function recordedDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "Not recorded";
  const whole = Math.floor(seconds);
  if (whole % 60 === 0) {
    const minutes = whole / 60;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return formatElapsed(whole);
}

function spokenDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  const minuteLabel = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const secondLabel = `${remainder} second${remainder === 1 ? "" : "s"}`;
  if (minutes === 0) return secondLabel;
  if (remainder === 0) return minuteLabel;
  return `${minuteLabel} and ${secondLabel}`;
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function subjectFromTitle(title: string): string | null {
  const subject = title.replace(/\s+knowledge report$/i, "").trim();
  return subject && subject !== title ? subject : null;
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not recorded";
}

function targetResult(met: boolean | null | undefined): string {
  if (met === true) return "Achieved";
  if (met === false) return "Not reached";
  return "Not recorded";
}

function thresholdResult(eligible: boolean | null | undefined): string {
  if (eligible === true) return "Not reached";
  if (eligible === false) return "Achieved";
  return "Not recorded";
}

function netChange(words: number | null | undefined): string | null {
  if (words == null || !Number.isFinite(words)) return null;
  if (words > 0) return `+${words}`;
  return String(words);
}

type EvidenceShape = "legacy" | "early" | "standard" | "additional" | "offered";

function evidenceShape(input: IndividualKnowledgeReportPdf): EvidenceShape {
  const { row } = input;
  const twoPhase = row.standardTimeWordCount != null
    || row.additionalTimeEligible != null
    || row.additionalTimeStarted != null;
  if (!twoPhase) return "legacy";
  if (row.additionalTimeStarted === true) return "additional";
  if (row.additionalTimeEligible === true) return "offered";
  if (row.submissionMethod === "manual" && !input.standardEndedAt) return "early";
  return "standard";
}

function timingLines(input: IndividualKnowledgeReportPdf): string[] {
  const { row } = input;
  const shape = evidenceShape(input);
  const targetWords = row.minimumWords == null ? "Not recorded" : `${row.minimumWords} words`;
  if (shape === "legacy") {
    return [
      `Time allowed: ${recordedDuration(row.durationSeconds)}`,
      `Time used: ${recordedDuration(row.elapsedSeconds)}`,
      `Target: ${targetWords}`,
      `Words produced: ${row.wordCount ?? "Not recorded"}`,
      `Target reached: ${minimumLabel(row.minimumMet)}`,
      `Submission: ${submissionMethodLabel(row.submissionMethod)}`,
      "Additional time: not recorded for this attempt",
    ];
  }
  if (shape === "early") {
    return [
      `Standard time allowed: ${recordedDuration(row.durationSeconds)}`,
      `Actual working time: ${row.elapsedSeconds == null ? "Not recorded" : formatElapsed(row.elapsedSeconds)}`,
      `Final word count: ${row.wordCount ?? "Not recorded"}`,
      `Student-facing target: ${targetWords}`,
      `Target reached: ${targetResult(row.minimumMet)}`,
      "Additional time: Not required",
      `Finalisation: ${submissionMethodLabel(row.submissionMethod)}`,
    ];
  }
  const lines = [
    `Standard time allowed: ${recordedDuration(row.durationSeconds)}`,
    `Words after standard time: ${row.standardTimeWordCount ?? "Not recorded"}`,
    `Standard-time threshold: ${row.additionalTimeThresholdWords == null ? "Not recorded" : `${row.additionalTimeThresholdWords} words`}`,
    `Threshold result: ${thresholdResult(row.additionalTimeEligible)}`,
    `Additional time offered: ${yesNo(row.additionalTimeEligible)}`,
    `Additional time used: ${yesNo(row.additionalTimeStarted)}`,
  ];
  if (shape === "offered") lines.push("Additional time started: No");
  if (shape === "additional") {
    lines.push(
      `Additional time allowed: ${recordedDuration(row.additionalTimeAllowanceSeconds)}`,
      `Actual additional time used: ${recordedDuration(row.additionalTimeUsedSeconds)}`,
      `Net words added during additional time: ${netChange(row.wordsAdded) ?? "Not recorded"}`,
    );
  }
  lines.push(
    `Final word count: ${row.wordCount ?? "Not recorded"}`,
    `Student-facing target: ${targetWords}`,
    `Final target: ${targetResult(row.minimumMet)}`,
  );
  if (shape === "additional" && row.elapsedSeconds != null && row.additionalTimeUsedSeconds != null) {
    lines.push(`Total working time: ${recordedDuration(row.elapsedSeconds + row.additionalTimeUsedSeconds)}`);
  }
  lines.push(`Finalisation: ${submissionMethodLabel(row.submissionMethod)}`);
  return lines;
}

function evidenceSummary(input: IndividualKnowledgeReportPdf): string {
  const { row } = input;
  const shape = evidenceShape(input);
  const period = row.durationSeconds != null && row.durationSeconds > 0 && row.durationSeconds % 60 === 0
    ? `standard ${row.durationSeconds / 60}-minute period`
    : "standard period";
  if (shape === "additional" && row.standardTimeWordCount != null && row.wordCount != null) {
    const allowance = row.additionalTimeAllowanceSeconds != null && row.additionalTimeAllowanceSeconds % 60 === 0
      ? `an additional ${row.additionalTimeAllowanceSeconds / 60} minutes was made available`
      : "additional time was made available";
    const change = row.wordsAdded == null
      ? ""
      : row.wordsAdded >= 0
        ? `, a net increase of ${row.wordsAdded} words`
        : `, a net change of ${row.wordsAdded} words`;
    return `The student produced ${row.standardTimeWordCount} words during the ${period}. The standard-time threshold was not reached, so ${allowance}. The student used the additional time and completed the task with ${row.wordCount} words${change}.`;
  }
  if (shape === "standard" && row.standardTimeWordCount != null) {
    return `The student produced ${row.standardTimeWordCount} words during the ${period} and achieved the standard-time threshold. Additional time was not used.`;
  }
  if (shape === "early" && row.minimumMet === true && row.minimumWords != null && row.elapsedSeconds != null) {
    return `The student reached the ${row.minimumWords}-word task target and submitted after ${spokenDuration(row.elapsedSeconds)}. Additional time was not used.`;
  }
  if (shape === "offered" && row.standardTimeWordCount != null) {
    return `The student produced ${row.standardTimeWordCount} words during the ${period}. The standard-time threshold was not reached, so additional time was offered. The student did not start the additional time.`;
  }
  return "This report uses the submitted evidence recorded for the attempt.";
}

function sameWriting(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim() === (right ?? "").trim();
}

function individualSections(input: IndividualKnowledgeReportPdf): string[] {
  const { row } = input;
  const shape = evidenceShape(input);
  const subject = subjectFromTitle(row.reportTitle);
  const topics = input.contentReview?.topics.map((topic) => (
    `${topic.label} — ${coverageLabel(topic.coverage)}. ${topic.reason}`
  )).join("\n") ?? "Not available.";
  const showStandardWriting = shape !== "legacy"
    && shape !== "early"
    && Boolean(input.standardTimeText?.trim())
    && !sameWriting(input.standardTimeText, input.reportText);
  const standardHeading = row.durationSeconds === 1800 ? "First 30 minutes" : "Standard time";
  const sections = [
    "title\nTimed Knowledge Report",
    "heading\nIndividual Student Evidence Report",
    `body\n${[
      subject ? `Subject: ${subject}` : null,
      `Student: ${row.learnerName || "Not recorded"}`,
      `Group: ${row.groupName || "Not recorded"}`,
      `Report: ${row.reportTitle || "Not recorded"}`,
      `Date completed: ${formatWhen(row.submittedAt)}`,
      `Generated: ${formatWhen(input.generatedAt.toISOString())}`,
    ].filter(Boolean).join("\n")}`,
    "heading\nTiming and Output Summary",
    `body\n${timingLines(input).join("\n")}`,
    "heading\nEvidence Summary",
    `body\n${evidenceSummary(input)}`,
  ];
  if (showStandardWriting) {
    sections.push(
      "heading\nWork Produced During Standard Time",
      `body\n${standardHeading}\n\n${input.standardTimeText}`,
    );
  }
  sections.push(
    "heading\nFinal Submitted Work",
    `body\n${input.reportText || "Not recorded"}`,
  );
  if (shape === "additional") {
    sections.push(
      "heading\nAdditional-Time Evidence",
      `body\n${[
        "Additional time offered: Yes",
        `Additional time started: ${formatWhen(input.additionalTimeStartedAt)}`,
        `Additional time allowed: ${recordedDuration(row.additionalTimeAllowanceSeconds)}`,
        `Additional time used: ${recordedDuration(row.additionalTimeUsedSeconds)}`,
        `Standard-time words: ${row.standardTimeWordCount ?? "Not recorded"}`,
        `Final words: ${row.wordCount ?? "Not recorded"}`,
        `Net word-count change: ${netChange(row.wordsAdded) ?? "Not recorded"}`,
        "The net change compares the final word count with the standard-time word count. It is not a count of keystrokes.",
      ].join("\n")}`,
    );
  }
  sections.push(
    "heading\nAdvisory Content Review",
    `body\nTask relevance: ${relevanceLabel(input.contentReview?.overallRelevance)}\n${input.contentReview?.summary ?? ""}\n\nAdvisory topic coverage\n${topics}\n\nFlags: ${input.contentReview?.repetitionNote ?? "None"}\n\n${CONTENT_REVIEW_ADVISORY}`,
    "heading\nTeacher Review",
    `body\n${input.teacherFeedback || "Not recorded"}${input.reviewedBy ? `\nReviewed by: ${input.reviewedBy}` : ""}\nReviewed: ${formatWhen(row.reviewedAt)}`,
  );
  return sections;
}

export function individualReportText(input: IndividualKnowledgeReportPdf): string {
  return individualSections(input).map((section) => section.replace(/^(title|heading|body)\n/, "")).join("\n");
}

export async function buildIndividualKnowledgeReportPdf(input: IndividualKnowledgeReportPdf): Promise<Uint8Array> {
  return documentWithLines(individualSections(input));
}

export function cohortCounts(rows: readonly KnowledgeReportRow[]) {
  const submitted = rows.filter((row) => row.completionStatus === "submitted" || row.completionStatus === "reviewed");
  return {
    assigned: rows.length,
    submitted: submitted.length,
    reviewed: rows.filter((row) => row.completionStatus === "reviewed").length,
    inProgress: rows.filter((row) => row.completionStatus === "in_progress" || row.completionStatus === "time_elapsed").length,
    notStarted: rows.filter((row) => row.completionStatus === "not_started").length,
    targetReached: submitted.filter((row) => row.minimumMet === true).length,
    targetNotReached: submitted.filter((row) => row.minimumMet === false).length,
    manual: submitted.filter((row) => row.submissionMethod === "manual").length,
    timeExpired: submitted.filter((row) => row.submissionMethod === "timer_expired").length,
    additionalTimeEligible: submitted.filter((row) => row.additionalTimeEligible === true).length,
    additionalTimeUsed: submitted.filter((row) => row.additionalTimeStarted === true).length,
    completedInStandardTime: submitted.filter((row) => row.additionalTimeStarted === false).length,
  };
}

function cohortSections(input: CohortKnowledgeReportPdf): string[] {
  const counts = cohortCounts(input.rows);
  const table = input.rows.map((row) => (
    `${row.learnerName} | ${row.wordCount ?? "—"} | ${minimumLabel(row.minimumMet)} | ${formatElapsed(row.elapsedSeconds)} | ${submissionMethodLabel(row.submissionMethod)} | ${extraTimeLabel(row)} | ${relevanceLabel(row.overallRelevance)} | ${reviewLabel(row)}`
  )).join("\n");
  return [
    "title\nTimed Knowledge Report",
    `body\n${input.title}`,
    "heading\nCohort Summary",
    `body\nGroup: ${input.groupLabel}\nGenerated: ${input.generatedAt.toISOString()}\nAssigned: ${counts.assigned}\nSubmitted: ${counts.submitted}\nReviewed: ${counts.reviewed}\nIn progress: ${counts.inProgress}\nNot started: ${counts.notStarted}\nTarget reached: ${counts.targetReached}\nTarget not reached: ${counts.targetNotReached}\nManual submissions: ${counts.manual}\nTime-expired submissions: ${counts.timeExpired}\nAdditional time eligible: ${counts.additionalTimeEligible}\nAdditional time used: ${counts.additionalTimeUsed}\nCompleted in standard time: ${counts.completedInStandardTime}`,
    "heading\nLearner | Words | Target | Time | Submission | Extra time | Relevance | Review",
    `body\n${table}`,
    `body\n${CONTENT_REVIEW_ADVISORY}`,
  ];
}

export function cohortReportText(input: CohortKnowledgeReportPdf): string {
  return cohortSections(input).map((section) => section.replace(/^(title|heading|body)\n/, "")).join("\n");
}

export async function buildCohortKnowledgeReportPdf(input: CohortKnowledgeReportPdf): Promise<Uint8Array> {
  return documentWithLines(cohortSections(input));
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
