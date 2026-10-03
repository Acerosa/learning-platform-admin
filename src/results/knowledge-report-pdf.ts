import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  CONTENT_REVIEW_ADVISORY,
  coverageLabel,
  extraTimeLabel,
  formatElapsed,
  minimumLabel,
  relevanceLabel,
  reviewLabel,
  statusLabel,
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

const REPORT_WIDTH = 595.28;
const REPORT_HEIGHT = 841.89;
const MARGIN_X = 50;
const CONTENT_BOTTOM = 66;
const CONTENT_WIDTH = REPORT_WIDTH - MARGIN_X * 2;
const INK = rgb(0.12, 0.16, 0.18);
const MUTED = rgb(0.36, 0.41, 0.44);
const ACCENT = rgb(0.12, 0.35, 0.37);
const PANEL = rgb(0.955, 0.964, 0.965);
const CARD = rgb(0.93, 0.945, 0.946);
const HAIRLINE = rgb(0.78, 0.81, 0.83);
const PARTIAL = rgb(0.45, 0.58, 0.59);
const ABSENT = rgb(0.72, 0.75, 0.76);

const PDF_FALLBACKS: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u2032": "'",
  "\u201C": "\"",
  "\u201D": "\"",
  "\u201E": "\"",
  "\u2013": "-",
  "\u2014": "-",
  "\u2212": "-",
  "\u2026": "...",
  "\u2022": "-",
  "\u25CF": "-",
  "\u25E6": "-",
  "\u00A0": " ",
  "\u200B": "",
  "\uFEFF": "",
  "\t": " ",
  "\uFB01": "fi",
  "\uFB02": "fl",
};

function pdfSafe(text: string, font: PDFFont): string {
  let safe = "";
  for (const char of text) {
    if (char === "\n" || char === "\r") {
      safe += char;
      continue;
    }
    const preferred = PDF_FALLBACKS[char] ?? char;
    try {
      font.widthOfTextAtSize(preferred, 10);
      safe += preferred;
    } catch {
      safe += "?";
    }
  }
  return safe;
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

function clockLabel(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function usedDurationLabel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "Not recorded";
  const whole = Math.floor(seconds);
  return whole % 60 === 0 ? recordedDuration(whole) : clockLabel(whole);
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
  if (row.additionalTimeThresholdWords != null) {
    lines.push(`Internal evidence threshold: ${row.additionalTimeThresholdWords} words — ${thresholdResult(row.additionalTimeEligible)}`);
  }
  if (shape === "additional") {
    lines.push(
      `Additional time allowed: ${recordedDuration(row.additionalTimeAllowanceSeconds)}`,
      `Actual additional time used: ${usedDurationLabel(row.additionalTimeUsedSeconds)}`,
      `Net words added during additional time: ${netChange(row.wordsAdded) ?? "Not recorded"}`,
      `Net word-count change: ${netChange(row.wordsAdded) ?? "Not recorded"}`,
    );
  }
  lines.push(
    `Final word count: ${row.wordCount ?? "Not recorded"}`,
    `Student-facing target: ${targetWords}`,
    `Student target: ${targetWords}`,
    `Final target: ${targetResult(row.minimumMet)}`,
    `Student target result: ${targetResult(row.minimumMet)}`,
  );
  if (shape === "additional" && row.elapsedSeconds != null && row.additionalTimeUsedSeconds != null) {
    lines.push(`Total working time: ${recordedDuration(row.elapsedSeconds + row.additionalTimeUsedSeconds)}`);
  }
  lines.push(`Finalisation: ${submissionMethodLabel(row.submissionMethod)}`);
  return lines;
}

const STAFF_ADVISORY = "This analysis assists staff review. It is not an assessment or support decision.";

function taskPeriod(seconds: number | null | undefined): string {
  if (seconds != null && seconds > 0 && seconds % 60 === 0) return `standard ${seconds / 60}-minute task period`;
  return "standard task period";
}

const NET_CHANGE_NOTE = "Net change compares the final word count with the standard-time word count. It does not represent individual keystrokes.";

const REPORT_PURPOSE = "Purpose: This report records evidence from the learner's timed Knowledge Report, including work produced during standard task time and, where applicable, additional time. It may be considered alongside other evidence when discussing whether further support or additional time may be appropriate.";

const DISCUSSION_ACKNOWLEDGEMENT = "This report has been discussed with the student. The student has had the opportunity to review the evidence recorded from their timed Knowledge Report.";

const SIGNATURE_RULE = "__________________________________";
const DATE_RULE = "__________________";
const COMMENT_RULE = "____________________________________________________";

function acknowledgementBody(learnerName: string, staffName: string): string {
  const student = learnerName.trim();
  const staff = staffName.trim();
  return [
    DISCUSSION_ACKNOWLEDGEMENT,
    "Student",
    `Student name: ${student || SIGNATURE_RULE}`,
    `Student signature: ${SIGNATURE_RULE}`,
    `Date: ${DATE_RULE}`,
    "Staff",
    `Staff name: ${staff || SIGNATURE_RULE}`,
    `Staff signature: ${SIGNATURE_RULE}`,
    `Date: ${DATE_RULE}`,
    "Comments (optional)",
    COMMENT_RULE,
    COMMENT_RULE,
    COMMENT_RULE,
  ].join("\n");
}

function evidenceSummary(input: IndividualKnowledgeReportPdf): string {
  const { row } = input;
  const shape = evidenceShape(input);
  const period = taskPeriod(row.durationSeconds);
  if (shape === "additional" && row.standardTimeWordCount != null && row.wordCount != null) {
    return `The learner produced ${row.standardTimeWordCount} words during the ${period}. Additional time was used, with the final submission increasing to ${row.wordCount} words.`;
  }
  if (shape === "standard" && row.standardTimeWordCount != null) {
    return `The learner completed the report within the standard task period, producing ${row.wordCount ?? row.standardTimeWordCount} words.`;
  }
  if (shape === "early" && row.elapsedSeconds != null && row.wordCount != null) {
    return `The learner submitted ${row.wordCount} words after ${spokenDuration(row.elapsedSeconds)}, within the standard task period.`;
  }
  if (shape === "offered" && row.standardTimeWordCount != null) {
    return `The learner produced ${row.standardTimeWordCount} words during the ${period}. Additional time was offered. The learner did not start the additional time.`;
  }
  return "This report uses the submitted evidence recorded for the attempt. Standard-time evidence and additional-time evidence were not recorded for this attempt.";
}

function sameWriting(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim() === (right ?? "").trim();
}

function showsDistinctStandardWriting(input: IndividualKnowledgeReportPdf): boolean {
  const shape = evidenceShape(input);
  return shape !== "legacy"
    && shape !== "early"
    && Boolean(input.standardTimeText?.trim())
    && !sameWriting(input.standardTimeText, input.reportText);
}

function clockOrNote(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "Not recorded";
  return clockLabel(seconds);
}

function standardWorkKicker(input: IndividualKnowledgeReportPdf): string {
  const words = input.row.standardTimeWordCount == null ? "Not recorded" : `${input.row.standardTimeWordCount} words`;
  if (input.row.durationSeconds != null && input.row.durationSeconds % 60 === 0) {
    return `${input.row.durationSeconds / 60} minutes | ${words}`;
  }
  return `Standard task time | ${words}`;
}

function standardEvidenceLabel(input: IndividualKnowledgeReportPdf): string {
  const clock = clockOrNote(input.row.durationSeconds);
  const words = input.row.standardTimeWordCount == null ? "NOT RECORDED" : `${input.row.standardTimeWordCount} WORDS`;
  return `STANDARD-TIME EVIDENCE · ${clock} · ${words}`;
}

function finalEvidenceLabel(input: IndividualKnowledgeReportPdf): string {
  const { row } = input;
  const shape = evidenceShape(input);
  const words = row.wordCount == null ? "NOT RECORDED" : `${row.wordCount} WORDS`;
  if (shape === "additional") {
    const change = netChange(row.wordsAdded) ?? "Not recorded";
    return `FINAL EVIDENCE · ${words} · ${change} WORDS AFTER ADDITIONAL TIME`;
  }
  if (shape === "standard") return `FINAL EVIDENCE · ${words} · COMPLETED WITHIN STANDARD TASK TIME`;
  if (shape === "offered") return `FINAL EVIDENCE · ${words} · ADDITIONAL TIME OFFERED, NOT STARTED`;
  if (shape === "early") {
    const elapsed = row.elapsedSeconds == null ? "Not recorded" : formatElapsed(row.elapsedSeconds);
    return `FINAL EVIDENCE · ${words} · SUBMITTED AFTER ${elapsed}`;
  }
  return `FINAL EVIDENCE · ${words}`;
}

function finalWorkKicker(input: IndividualKnowledgeReportPdf): string | null {
  const { row } = input;
  const shape = evidenceShape(input);
  const words = row.wordCount == null ? "Not recorded" : `${row.wordCount} words`;
  if (shape === "additional") {
    const used = row.additionalTimeUsedSeconds == null ? "Not recorded" : clockLabel(row.additionalTimeUsedSeconds);
    return `Final: ${words} | Additional time used: ${used} | Net change: ${netChange(row.wordsAdded) ?? "Not recorded"}`;
  }
  if (shape === "standard") return `${words} | Completed within standard task time`;
  if (shape === "offered") return `${words} | Additional time offered, not started`;
  if (shape === "early") {
    const elapsed = row.elapsedSeconds == null ? "Not recorded" : formatElapsed(row.elapsedSeconds);
    return `${words} | Submitted after ${elapsed}`;
  }
  return null;
}

interface PeriodColumn {
  title: string;
  headline: string;
  detail: string;
  lines: string[];
  tone: "standard" | "additional" | "final";
}

function submissionEvidence(method: string | null | undefined, fullAllowanceUsed: boolean): string {
  if (method === "additional_time_expired" && fullAllowanceUsed) return "Submitted when additional time expired";
  if (method === "additional_time_expired") return "Additional-time expiry";
  return submissionMethodLabel(method);
}

function periodColumns(input: IndividualKnowledgeReportPdf): PeriodColumn[] {
  const { row } = input;
  const shape = evidenceShape(input);
  const finalWords = row.wordCount == null ? "Not recorded" : String(row.wordCount);
  const targetWords = row.minimumWords == null ? "Not recorded" : `${row.minimumWords} words`;
  if (shape === "legacy") {
    return [
      {
        title: "STANDARD TASK TIME",
        headline: "Not recorded",
        detail: "not collected",
        lines: ["Standard-time evidence: Not recorded"],
        tone: "standard",
      },
      {
        title: "ADDITIONAL TIME",
        headline: "Not recorded",
        detail: "Not collected",
        lines: ["Additional-time evidence: Not recorded", "Additional time: not recorded for this attempt"],
        tone: "additional",
      },
      {
        title: "FINAL OUTCOME",
        headline: finalWords,
        detail: "Final word count",
        lines: [
          `Time allowed: ${recordedDuration(row.durationSeconds)}`,
          `Time used: ${recordedDuration(row.elapsedSeconds)}`,
          `Final word count: ${row.wordCount ?? "Not recorded"}`,
          `Student target: ${targetWords}`,
          `Target: ${minimumLabel(row.minimumMet)}`,
          `Submission: ${submissionMethodLabel(row.submissionMethod)}`,
        ],
        tone: "final",
      },
    ];
  }
  if (shape === "early") {
    const elapsed = row.elapsedSeconds == null ? "Not recorded" : formatElapsed(row.elapsedSeconds);
    return [
      {
        title: "STANDARD TASK",
        headline: elapsed,
        detail: "completed in",
        lines: [
          `Time allowed: ${recordedDuration(row.durationSeconds)}`,
          `Task completed in: ${elapsed}`,
        ],
        tone: "standard",
      },
      {
        title: "ADDITIONAL TIME",
        headline: "Not applicable",
        detail: "not required",
        lines: ["Additional time: Not required"],
        tone: "additional",
      },
      {
        title: "FINAL OUTCOME",
        headline: finalWords,
        detail: "Final word count",
        lines: [
          `Final word count: ${row.wordCount ?? "Not recorded"}`,
          `Student target: ${targetWords}`,
          `Student target result: ${targetResult(row.minimumMet)}`,
          `Submission: ${submissionMethodLabel(row.submissionMethod)}`,
        ],
        tone: "final",
      },
    ];
  }
  const standardWords = row.standardTimeWordCount == null ? "Not recorded" : String(row.standardTimeWordCount);
  const standardColumn: PeriodColumn = {
    title: "STANDARD TASK TIME",
    headline: clockOrNote(row.durationSeconds),
    detail: `${standardWords} words`,
    lines: [
      `Time allowed: ${recordedDuration(row.durationSeconds)}`,
      `Words produced: ${standardWords}`,
      row.additionalTimeThresholdWords == null ? "Threshold: Not recorded" : `Threshold: ${row.additionalTimeThresholdWords} words`,
      `Result: ${thresholdResult(row.additionalTimeEligible)}`,
    ],
    tone: "standard",
  };
  let additionalColumn: PeriodColumn;
  if (shape === "additional") {
    const usedClock = clockOrNote(row.additionalTimeUsedSeconds);
    const fullAllowance = row.additionalTimeAllowanceSeconds != null
      && row.additionalTimeUsedSeconds != null
      && row.additionalTimeUsedSeconds === row.additionalTimeAllowanceSeconds;
    additionalColumn = {
      title: "ADDITIONAL TIME",
      headline: usedClock,
      detail: fullAllowance ? "used" : "actually used",
      lines: [
        "Offered: Yes",
        `Allowed: ${clockOrNote(row.additionalTimeAllowanceSeconds)}`,
        `Actually used: ${usedClock}`,
        `Words added: ${netChange(row.wordsAdded) ?? "Not recorded"}`,
      ],
      tone: "additional",
    };
  } else if (shape === "offered") {
    additionalColumn = {
      title: "ADDITIONAL TIME",
      headline: "Offered",
      detail: "Not started",
      lines: [
        "Offered: Yes",
        `Allowed: ${clockOrNote(row.additionalTimeAllowanceSeconds)}`,
        "Actually used: Not started",
        "Additional time started: No",
      ],
      tone: "additional",
    };
  } else {
    additionalColumn = {
      title: "ADDITIONAL TIME",
      headline: "Not offered",
      detail: "not used",
      lines: ["Offered: No", "Used: No"],
      tone: "additional",
    };
  }
  const total = shape === "additional" && row.elapsedSeconds != null && row.additionalTimeUsedSeconds != null
    ? clockLabel(row.elapsedSeconds + row.additionalTimeUsedSeconds)
    : null;
  const fullAllowance = row.additionalTimeAllowanceSeconds != null
    && row.additionalTimeUsedSeconds != null
    && row.additionalTimeUsedSeconds === row.additionalTimeAllowanceSeconds;
  const finalColumn: PeriodColumn = {
    title: "FINAL OUTCOME",
    headline: finalWords,
    detail: total ? `${total} total` : "Final word count",
    lines: [
      `Final word count: ${row.wordCount ?? "Not recorded"}`,
      `Student target: ${targetWords}`,
      `Target: ${targetResult(row.minimumMet)}`,
      total ? `Total working time: ${total}` : "Completed within standard task time",
      `Submission: ${shape === "additional" ? submissionEvidence(row.submissionMethod, fullAllowance) : submissionMethodLabel(row.submissionMethod)}`,
    ],
    tone: "final",
  };
  return [standardColumn, additionalColumn, finalColumn];
}

function individualSections(input: IndividualKnowledgeReportPdf): string[] {
  const { row } = input;
  const shape = evidenceShape(input);
  const subject = subjectFromTitle(row.reportTitle);
  const topics = input.contentReview?.topics.map((topic) => (
    `${topic.label} — ${coverageLabel(topic.coverage)}. ${topic.reason}`
  )).join("\n") ?? "Not available.";
  const showStandardWriting = showsDistinctStandardWriting(input);
  const finalKicker = finalWorkKicker(input);
  const reviewer = input.reviewedBy?.trim() ?? "";
  const sections = [
    "title\nNORTH HERTFORDSHIRE COLLEGE",
    `heading\n${subject ? `${subject} | Knowledge Report` : "Knowledge Report"}`,
    "heading\nIndividual Student Evidence Report",
    `body\n${[
      subject ? `Subject: ${subject}` : null,
      `Student: ${row.learnerName || "Not recorded"}`,
      `Group: ${row.groupName || "Not recorded"}`,
      `Report: ${row.reportTitle || "Not recorded"}`,
      `Status: ${statusLabel(row.completionStatus)}`,
      `Completed: ${formatWhen(row.submittedAt)}`,
      `Date completed: ${formatWhen(row.submittedAt)}`,
      `Report generated: ${formatWhen(input.generatedAt.toISOString())}`,
      `Generated: ${formatWhen(input.generatedAt.toISOString())}`,
    ].filter(Boolean).join("\n")}`,
    `body\n${REPORT_PURPOSE}`,
    "heading\nTiming and Output Evidence",
    `body\n${periodColumns(input).map((column) => [column.title, column.headline, column.detail, ...column.lines].join("\n")).join("\n")}\n${timingLines(input).join("\n")}`,
    "heading\nEvidence Summary",
    `body\n${evidenceSummary(input)}`,
  ];
  if (shape === "additional") sections.push(`body\n${NET_CHANGE_NOTE}`);
  if (showStandardWriting) {
    sections.push(
      `body\n${standardEvidenceLabel(input)}`,
      "heading\nWork Produced During Standard Task Time",
      `body\n${input.row.durationSeconds === 1800 ? "First 30 minutes\n" : ""}${standardWorkKicker(input)}\n\n${input.standardTimeText}`,
    );
  }
  if (showStandardWriting) sections.push("body\nAFTER ADDITIONAL TIME");
  sections.push(
    `body\n${finalEvidenceLabel(input)}`,
    "heading\nFinal Submitted Work",
    `body\n${finalKicker ? `${finalKicker}\n\n` : ""}${input.reportText || "Not recorded"}`,
  );
  sections.push(
    "heading\nAdvisory Content Review",
    `body\nTask relevance: ${relevanceLabel(input.contentReview?.overallRelevance)}\nOverall relevance: ${relevanceLabel(input.contentReview?.overallRelevance)}\n${input.contentReview?.summary ?? ""}\n\nAdvisory topic coverage\n${topics}\n\nFlags: ${input.contentReview?.repetitionNote ?? "None"}\n\n${STAFF_ADVISORY}\n${CONTENT_REVIEW_ADVISORY}`,
    "heading\nTeacher Review",
    `body\nReview status: ${reviewLabel(row)}\n${input.teacherFeedback || "Not recorded"}${reviewer ? `\nReviewed by: ${reviewer}` : ""}${row.reviewedAt ? `\nReviewed: ${formatWhen(row.reviewedAt)}` : ""}`,
    "heading\nStudent Discussion and Acknowledgement",
    `body\n${acknowledgementBody(row.learnerName || "", reviewer)}`,
  );
  return sections;
}

export function individualReportText(input: IndividualKnowledgeReportPdf): string {
  return individualSections(input).map((section) => section.replace(/^(title|heading|body)\n/, "")).join("\n");
}

export async function buildIndividualKnowledgeReportPdf(input: IndividualKnowledgeReportPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const pages: PDFPage[] = [];
  let page = pdf.addPage([REPORT_WIDTH, REPORT_HEIGHT]);
  pages.push(page);
  let y = REPORT_HEIGHT - 32;

  function newPage() {
    page = pdf.addPage([REPORT_WIDTH, REPORT_HEIGHT]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: REPORT_HEIGHT - 6, width: REPORT_WIDTH, height: 6, color: ACCENT });
    y = REPORT_HEIGHT - 36;
  }

  function ensure(height: number) {
    if (y - height < CONTENT_BOTTOM) newPage();
  }

  function drawWrapped(text: string, font: PDFFont, size: number, color: ReturnType<typeof rgb>, x: number, width: number, leading: number) {
    const lines = wrap(pdfSafe(text, font), font, size, width);
    for (const line of lines) {
      ensure(leading);
      if (line) page.drawText(line, { x, y, size, font, color });
      y -= line ? leading : Math.max(8, leading - 6);
    }
  }

  function drawHeading(text: string, reserve = 44) {
    if (reserve > 0) ensure(reserve);
    y -= 4;
    page.drawText(pdfSafe(text, bold), { x: MARGIN_X, y, size: 13, font: bold, color: ACCENT });
    const ruleY = y - 4;
    page.drawLine({
      start: { x: MARGIN_X, y: ruleY },
      end: { x: MARGIN_X + 42, y: ruleY },
      thickness: 1.4,
      color: ACCENT,
    });
    y -= 14;
  }

  function drawEvidenceLabel(text: string) {
    const safe = pdfSafe(text, bold);
    ensure(22);
    page.drawRectangle({ x: MARGIN_X, y: y - 6, width: CONTENT_WIDTH, height: 16, color: CARD });
    page.drawRectangle({ x: MARGIN_X, y: y - 6, width: 3, height: 16, color: ACCENT });
    page.drawText(safe, { x: MARGIN_X + 10, y: y - 1, size: 8, font: bold, color: ACCENT });
    y -= 20;
  }

  const { row } = input;
  const subject = subjectFromTitle(row.reportTitle) ?? "Knowledge Report";
  page.drawRectangle({ x: 0, y: REPORT_HEIGHT - 8, width: REPORT_WIDTH, height: 8, color: ACCENT });
  page.drawText("NORTH HERTFORDSHIRE COLLEGE", { x: MARGIN_X, y, size: 9, font: sans, color: ACCENT });
  y -= 20;
  page.drawText(pdfSafe(`${subject} | Knowledge Report`, bold), { x: MARGIN_X, y, size: 16, font: bold, color: INK });
  y -= 16;
  page.drawText("Individual Student Evidence Report", { x: MARGIN_X, y, size: 11, font: sans, color: MUTED });
  y -= 12;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: REPORT_WIDTH - MARGIN_X, y },
    thickness: 0.6,
    color: HAIRLINE,
  });
  y -= 16;

  const details: Array<[string, string]> = [
    ["Student", row.learnerName || "Not recorded"],
    ["Group", row.groupName || "Not recorded"],
    ["Report", row.reportTitle || "Not recorded"],
    ["Status", statusLabel(row.completionStatus)],
    ["Completed", formatWhen(row.submittedAt)],
    ["Report generated", formatWhen(input.generatedAt.toISOString())],
  ];
  const columnWidth = (CONTENT_WIDTH - 36) / 2;
  const detailRows: Array<[[string, string], [string, string]]> = [
    [details[0], details[1]],
    [details[2], details[3]],
    [details[4], details[5]],
  ];
  const detailRowHeights = detailRows.map(([left, right]) => {
    const leftLines = wrap(pdfSafe(left[1], sans), sans, 10, columnWidth - 4).length;
    const rightLines = wrap(pdfSafe(right[1], sans), sans, 10, columnWidth - 4).length;
    return 16 + Math.max(leftLines, rightLines) * 13;
  });
  const panelHeight = 16 + detailRowHeights.reduce((sum, height) => sum + height, 0);
  ensure(panelHeight + 8);
  const panelTop = y + 4;
  page.drawRectangle({
    x: MARGIN_X,
    y: panelTop - panelHeight,
    width: CONTENT_WIDTH,
    height: panelHeight,
    color: PANEL,
  });
  let detailY = panelTop - 18;
  detailRows.forEach(([left, right], index) => {
    [left, right].forEach((item, column) => {
      const x = MARGIN_X + 14 + column * (columnWidth + 8);
      page.drawText(item[0], { x, y: detailY, size: 8, font: sans, color: MUTED });
      const valueLines = wrap(pdfSafe(item[1], sans), sans, 10, columnWidth - 4);
      valueLines.forEach((line, lineIndex) => {
        page.drawText(line, { x, y: detailY - 13 - lineIndex * 13, size: 10, font: sans, color: INK });
      });
    });
    detailY -= detailRowHeights[index];
  });
  y = panelTop - panelHeight - 12;

  const purposeLines = wrap(pdfSafe(REPORT_PURPOSE, sans), sans, 9, CONTENT_WIDTH);
  ensure(purposeLines.length * 12 + 8);
  for (const line of purposeLines) {
    if (line) page.drawText(line, { x: MARGIN_X, y, size: 9, font: sans, color: MUTED });
    y -= 12;
  }
  y -= 6;

  drawHeading("Timing and Output Evidence", 44);
  const columns = periodColumns(input);
  const columnGap = 8;
  const periodWidth = (CONTENT_WIDTH - columnGap * (columns.length - 1)) / columns.length;
  const columnInner = periodWidth - 16;
  const columnHeights = columns.map((column) => {
    const factLines = column.lines.reduce((count, line) => count + wrap(pdfSafe(line, sans), sans, 8, columnInner).length, 0);
    return 78 + factLines * 11;
  });
  const columnHeight = Math.max(...columnHeights);
  ensure(columnHeight + 4);
  const columnTop = y + 4;
  const headerFill = {
    standard: ACCENT,
    additional: rgb(0.9, 0.94, 0.94),
    final: INK,
  };
  const headerInk = {
    standard: rgb(1, 1, 1),
    additional: ACCENT,
    final: rgb(1, 1, 1),
  };
  columns.forEach((column, index) => {
    const x = MARGIN_X + index * (periodWidth + columnGap);
    page.drawRectangle({ x, y: columnTop - columnHeight, width: periodWidth, height: columnHeight, color: CARD });
    page.drawRectangle({ x, y: columnTop - 20, width: periodWidth, height: 20, color: headerFill[column.tone] });
    page.drawRectangle({ x, y: columnTop - columnHeight, width: 4, height: columnHeight, color: column.tone === "final" ? INK : ACCENT });
    page.drawText(pdfSafe(column.title, bold), { x: x + 10, y: columnTop - 14, size: 7.5, font: bold, color: headerInk[column.tone] });
    page.drawText(pdfSafe(column.headline, bold), { x: x + 10, y: columnTop - 40, size: 14, font: bold, color: INK });
    page.drawText(pdfSafe(column.detail, sans), { x: x + 10, y: columnTop - 54, size: 8, font: sans, color: MUTED });
    let lineY = columnTop - 72;
    for (const line of column.lines) {
      for (const wrapped of wrap(pdfSafe(line, sans), sans, 8, columnInner)) {
        if (wrapped) page.drawText(wrapped, { x: x + 10, y: lineY, size: 8, font: sans, color: INK });
        lineY -= 11;
      }
    }
  });
  y = columnTop - columnHeight - 12;
  const shape = evidenceShape(input);
  if (shape !== "legacy" && shape !== "early" && row.additionalTimeThresholdWords != null) {
    drawWrapped(
      `Internal evidence threshold: ${row.additionalTimeThresholdWords} words — ${thresholdResult(row.additionalTimeEligible)}`,
      sans,
      10,
      INK,
      MARGIN_X,
      CONTENT_WIDTH,
      14,
    );
    y -= 4;
  }
  if (shape === "additional") {
    y -= 2;
    drawWrapped(NET_CHANGE_NOTE, oblique, 8, MUTED, MARGIN_X, CONTENT_WIDTH, 11);
    y -= 2;
  }

  drawHeading("Evidence Summary", 40);
  drawWrapped(evidenceSummary(input), sans, 10, INK, MARGIN_X, CONTENT_WIDTH, 13);
  y -= 2;

  if (showsDistinctStandardWriting(input)) {
    ensure(58);
    drawEvidenceLabel(standardEvidenceLabel(input));
    drawHeading("Work Produced During Standard Task Time", 0);
    drawWrapped(input.standardTimeText ?? "", serif, 11, INK, MARGIN_X, CONTENT_WIDTH, 15);
  }

  const separateWritings = showsDistinctStandardWriting(input);
  if (separateWritings) {
    ensure(72);
    y -= 6;
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 12,
      width: CONTENT_WIDTH,
      height: 20,
      color: rgb(0.9, 0.94, 0.94),
    });
    page.drawRectangle({ x: MARGIN_X, y: y + 8, width: CONTENT_WIDTH, height: 1.6, color: ACCENT });
    page.drawText("AFTER ADDITIONAL TIME", { x: MARGIN_X + 10, y: y - 6, size: 8, font: bold, color: ACCENT });
    y -= 22;
  } else {
    ensure(52);
  }
  drawEvidenceLabel(finalEvidenceLabel(input));
  drawHeading("Final Submitted Work", 0);
  drawWrapped(input.reportText || "Not recorded", serif, 11, INK, MARGIN_X, CONTENT_WIDTH, 15);

  drawHeading("Advisory Content Review", 46);
  const relevance = `Overall relevance: ${input.contentReview ? relevanceLabel(input.contentReview.overallRelevance) : "Not recorded"}`;
  ensure(16);
  page.drawText(pdfSafe(relevance, bold), { x: MARGIN_X, y, size: 11, font: bold, color: INK });
  y -= 16;
  if (input.contentReview?.summary) {
    drawWrapped(input.contentReview.summary, serif, 11, INK, MARGIN_X, CONTENT_WIDTH, 15);
    y -= 4;
  }
  const topics = input.contentReview?.topics ?? [];
  if (topics.length === 0) {
    drawWrapped("Advisory topic coverage: Not available.", serif, 11, INK, MARGIN_X, CONTENT_WIDTH, 15);
  }
  for (const topic of topics) {
    const reason = wrap(pdfSafe(topic.reason, serif), serif, 10, CONTENT_WIDTH - 16);
    const block = 28 + reason.length * 13;
    ensure(block < 90 ? block : 28);
    const mark = topic.coverage === "demonstrated" ? ACCENT : topic.coverage === "partial" ? PARTIAL : ABSENT;
    page.drawRectangle({ x: MARGIN_X, y: y - 2, width: 7, height: 7, color: mark });
    const topicLine = `${topic.label} — ${coverageLabel(topic.coverage)}`;
    page.drawText(pdfSafe(topicLine, bold), { x: MARGIN_X + 14, y, size: 10, font: bold, color: INK });
    y -= 14;
    for (const line of reason) {
      ensure(13);
      if (line) page.drawText(line, { x: MARGIN_X + 14, y, size: 10, font: serif, color: MUTED });
      y -= 13;
    }
    y -= 3;
  }
  const flags = `Flags: ${input.contentReview?.repetitionNote ?? "None"}`;
  drawWrapped(flags, sans, 10, INK, MARGIN_X, CONTENT_WIDTH, 13);
  y -= 2;
  const disclaimerLines = wrap(pdfSafe(STAFF_ADVISORY, oblique), oblique, 9, CONTENT_WIDTH - 20);
  const disclaimerHeight = 16 + disclaimerLines.length * 12;
  ensure(disclaimerHeight + 4);
  const disclaimerTop = y + 4;
  page.drawRectangle({
    x: MARGIN_X,
    y: disclaimerTop - disclaimerHeight,
    width: CONTENT_WIDTH,
    height: disclaimerHeight,
    color: PANEL,
  });
  disclaimerLines.forEach((line, index) => {
    page.drawText(line, { x: MARGIN_X + 10, y: disclaimerTop - 16 - index * 12, size: 9, font: oblique, color: MUTED });
  });
  y = disclaimerTop - disclaimerHeight - 10;

  drawHeading("Teacher Review", 44);
  const reviewer = input.reviewedBy?.trim() ?? "";
  const teacherLines = [
    `Review status: ${reviewLabel(row)}`,
    input.teacherFeedback || "Not recorded",
    reviewer ? `Reviewed by: ${reviewer}` : "",
    row.reviewedAt ? `Reviewed: ${formatWhen(row.reviewedAt)}` : "",
  ].filter(Boolean);
  for (const line of teacherLines) {
    drawWrapped(line, line.startsWith("Review status:") || line.startsWith("Reviewed") ? sans : serif, 11, INK, MARGIN_X, CONTENT_WIDTH, 15);
  }

  const acknowledgementLines = wrap(pdfSafe(DISCUSSION_ACKNOWLEDGEMENT, sans), sans, 10, CONTENT_WIDTH);
  const introLeading = 12;
  const afterHeading = 6;
  const afterIntro = 8;
  const kickerDrop = 18;
  const nameDrop = 18;
  const signatureDrop = 36;
  const afterSignatureRule = 18;
  const dateDrop = 22;
  const beforeComments = 14;
  const commentLabelDrop = 16;
  const commentDrop = 24;
  const acknowledgementHeight = 18 + afterHeading + acknowledgementLines.length * introLeading + afterIntro
    + kickerDrop + nameDrop + signatureDrop + afterSignatureRule + dateDrop
    + beforeComments + commentLabelDrop + commentDrop * 3;
  ensure(acknowledgementHeight);
  drawHeading("Student Discussion and Acknowledgement", 0);
  y -= afterHeading;
  for (const line of acknowledgementLines) {
    if (line) page.drawText(line, { x: MARGIN_X, y, size: 10, font: sans, color: INK });
    y -= introLeading;
  }
  y -= afterIntro;
  const signatureGap = 28;
  const signatureColumnWidth = (CONTENT_WIDTH - signatureGap) / 2;
  const staffName = reviewer;
  const studentName = row.learnerName.trim();
  drawTextAt("Student", MARGIN_X, y, 10, bold, ACCENT);
  drawTextAt("Staff", MARGIN_X + signatureColumnWidth + signatureGap, y, 10, bold, ACCENT);
  y -= kickerDrop;
  drawNameRow(MARGIN_X, y, "Student name:", studentName, signatureColumnWidth);
  drawNameRow(MARGIN_X + signatureColumnWidth + signatureGap, y, "Staff name:", staffName, signatureColumnWidth);
  y -= nameDrop;
  drawTextAt("Student signature:", MARGIN_X, y, 9, sans, MUTED);
  drawTextAt("Staff signature:", MARGIN_X + signatureColumnWidth + signatureGap, y, 9, sans, MUTED);
  y -= signatureDrop;
  drawTextAt(ruleFor(signatureColumnWidth), MARGIN_X, y, 10, sans, INK);
  drawTextAt(ruleFor(signatureColumnWidth), MARGIN_X + signatureColumnWidth + signatureGap, y, 10, sans, INK);
  y -= afterSignatureRule;
  drawDateRow(MARGIN_X, y, signatureColumnWidth);
  drawDateRow(MARGIN_X + signatureColumnWidth + signatureGap, y, signatureColumnWidth);
  y -= dateDrop;
  y -= beforeComments;
  drawTextAt("Comments (optional)", MARGIN_X, y, 10, sans, INK);
  y -= commentLabelDrop;
  const commentRule = ruleFor(CONTENT_WIDTH);
  for (let index = 0; index < 3; index += 1) {
    drawTextAt(commentRule, MARGIN_X, y, 10, sans, INK);
    y -= commentDrop;
  }

  function ruleFor(width: number): string {
    const underscore = sans.widthOfTextAtSize("_", 10);
    return "_".repeat(Math.max(8, Math.floor(width / underscore)));
  }

  function drawTextAt(text: string, x: number, baseline: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
    page.drawText(pdfSafe(text, font), { x, y: baseline, size, font, color });
  }

  function drawNameRow(x: number, baseline: number, label: string, value: string, width: number) {
    drawTextAt(label, x, baseline, 9, sans, MUTED);
    const labelWidth = sans.widthOfTextAtSize(label, 9);
    const valueX = x + labelWidth + 6;
    if (value) drawTextAt(value, valueX, baseline, 10, sans, INK);
    else drawTextAt(ruleFor(width - labelWidth - 6), valueX, baseline, 10, sans, INK);
  }

  function drawDateRow(x: number, baseline: number, width: number) {
    drawTextAt("Date:", x, baseline, 9, sans, MUTED);
    const labelWidth = sans.widthOfTextAtSize("Date:", 9);
    drawTextAt(ruleFor(Math.min(130, width - labelWidth - 6)), x + labelWidth + 6, baseline, 10, sans, INK);
  }

  const learnerName = row.learnerName || "Not recorded";
  pages.forEach((item, index) => {
    item.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: REPORT_WIDTH - MARGIN_X, y: 42 },
      thickness: 0.4,
      color: HAIRLINE,
    });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    const pageWidth = sans.widthOfTextAtSize(pageLabel, 8);
    let footer = pdfSafe(`NHC | Cyber Security Knowledge Report | ${learnerName}`, sans);
    const maxWidth = CONTENT_WIDTH - pageWidth - 16;
    while (footer.length > 12 && sans.widthOfTextAtSize(footer, 8) > maxWidth) footer = footer.slice(0, -1).trimEnd();
    item.drawText(footer, { x: MARGIN_X, y: 28, size: 8, font: sans, color: MUTED });
    item.drawText(pageLabel, { x: REPORT_WIDTH - MARGIN_X - pageWidth, y: 28, size: 8, font: sans, color: MUTED });
  });

  return pdf.save();
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
