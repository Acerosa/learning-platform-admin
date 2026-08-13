import { getContentEngine } from "./engine.ts";
import { sanitizeObject } from "./sanitize.ts";
import type { ContentPackage } from "./types";

export function parseJsonImport(text: string) {
  const value = JSON.parse(text) as unknown;
  return sanitizeObject(value);
}

export function parseCsvWorkbook(files: Record<string, string>, hub: unknown, curriculum: unknown) {
  const engine = getContentEngine();
  const clean: Record<string, string> = {};
  Object.entries(files).forEach(([name, text]) => {
    clean[name] = String(sanitizeObject(text));
  });
  return engine.importFromCsvSheets(clean, hub, curriculum) as ContentPackage;
}

export function sheetsFromWorkbook(workbook: { SheetNames: string[]; Sheets: Record<string, unknown> }, utils: {
  sheet_to_json: (sheet: unknown, opts: { defval: string; raw: boolean }) => Record<string, unknown>[];
}) {
  const engine = getContentEngine();
  const sheets: Record<string, Record<string, string>[]> = {};
  workbook.SheetNames.forEach((name) => {
    const rows = utils.sheet_to_json(workbook.Sheets[name], { defval: "", raw: false }) as Record<string, unknown>[];
    sheets[name] = rows.map((row) => {
      const record: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        record[String(key).trim()] = String(value ?? "").trim();
      });
      return record;
    });
  });
  engine.EXCEL_SHEET_NAMES.forEach((name) => {
    if (!sheets[name]) sheets[name] = [];
  });
  if (!sheets.Options) sheets.Options = [];
  if (!sheets.Feedback) sheets.Feedback = [];
  return sheets;
}

export function applyWorkbookExtensions(
  pkg: ContentPackage,
  sheets: Record<string, Record<string, string>[]>,
): ContentPackage {
  const options = sheets.Options || [];
  const feedback = sheets.Feedback || [];
  const activities = pkg.activities.map((activity) => ({
    ...activity,
    blocks: activity.blocks.map((block) => {
      const blockOptions = options.filter((row) => row.blockId === block.id);
      const blockFeedback = feedback.find((row) => row.blockId === block.id);
      const content = { ...(block.content || {}) };
      if (blockOptions.length) {
        content.options = blockOptions.map((row) => ({
          id: row.optionId || row.id,
          label: row.label,
        }));
        const correct = blockOptions.find((row) => String(row.correct).toLowerCase() === "true");
        if (correct) content.correctOptionId = correct.optionId || correct.id;
      }
      if (blockFeedback) {
        content.feedback = {
          correct: blockFeedback.correct || "",
          incorrect: blockFeedback.incorrect || "",
        };
      }
      if (typeof content.questionId !== "string" || !content.questionId) {
        content.questionId = `${block.id}-q`;
      }
      return { ...block, content };
    }),
  }));
  return { ...pkg, activities };
}
