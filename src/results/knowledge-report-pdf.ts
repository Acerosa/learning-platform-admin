import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import {
  CONTENT_REVIEW_ADVISORY,
  coverageLabel,
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

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
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

function individualSections(input: IndividualKnowledgeReportPdf): string[] {
  const { row } = input;
  const topics = input.contentReview?.topics.map((topic) => (
    `${topic.label} - ${coverageLabel(topic.coverage)}. ${topic.reason}`
  )).join("\n") ?? "Not available.";
  return [
    "title\nTimed Knowledge Report - Cyber Security",
    `body\n${row.reportTitle}`,
    `body\nStudent: ${row.learnerName}\nGroup: ${row.groupName}\nDate: ${row.submittedAt ?? "—"}\nGenerated: ${input.generatedAt.toISOString()}`,
    "heading\nSitting Summary",
    `body\nTime allowed: ${formatElapsed(row.durationSeconds)}\nTime used: ${formatElapsed(row.elapsedSeconds)}\nTarget: ${row.minimumWords ?? "—"} words\nWords produced: ${row.wordCount ?? "—"}\nTarget reached: ${minimumLabel(row.minimumMet)}\nSubmission: ${submissionMethodLabel(row.submissionMethod)}`,
    "heading\nAdvisory Content Review",
    `body\nTask relevance: ${relevanceLabel(input.contentReview?.overallRelevance)}\n${input.contentReview?.summary ?? ""}\n\nAdvisory Topic Coverage\n${topics}\n\nFlags: ${input.contentReview?.repetitionNote ?? "None"}\n\n${CONTENT_REVIEW_ADVISORY}`,
    "heading\nStudent’s Submitted Report",
    `body\n${input.reportText}`,
    "heading\nTeacher Review",
    `body\n${input.teacherFeedback || "—"}${input.reviewedBy ? `\nReviewed by: ${input.reviewedBy}` : ""}\nReviewed: ${row.reviewedAt ?? "—"}`,
  ];
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
  };
}

export async function buildCohortKnowledgeReportPdf(input: CohortKnowledgeReportPdf): Promise<Uint8Array> {
  const counts = cohortCounts(input.rows);
  const table = input.rows.map((row) => (
    `${row.learnerName} | ${row.wordCount ?? "—"} | ${minimumLabel(row.minimumMet)} | ${formatElapsed(row.elapsedSeconds)} | ${submissionMethodLabel(row.submissionMethod)} | ${relevanceLabel(row.overallRelevance)} | ${reviewLabel(row)}`
  )).join("\n");
  return documentWithLines([
    "title\nTimed Knowledge Report",
    `body\n${input.title}`,
    "heading\nCohort Summary",
    `body\nGroup: ${input.groupLabel}\nGenerated: ${input.generatedAt.toISOString()}\nAssigned: ${counts.assigned}\nSubmitted: ${counts.submitted}\nReviewed: ${counts.reviewed}\nIn progress: ${counts.inProgress}\nNot started: ${counts.notStarted}\nTarget reached: ${counts.targetReached}\nTarget not reached: ${counts.targetNotReached}\nManual submissions: ${counts.manual}\nTime-expired submissions: ${counts.timeExpired}`,
    "heading\nLearner | Words | Target | Time | Submission | Relevance | Review",
    `body\n${table}`,
    `body\n${CONTENT_REVIEW_ADVISORY}`,
  ]);
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
