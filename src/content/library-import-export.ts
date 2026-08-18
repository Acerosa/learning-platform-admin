import type { LibraryQuestion, LibraryActivity, LibraryResource } from "./library-reuse.ts";

export interface LibraryExportPackage {
  exportedAt: string;
  format: "nhc-library-export";
  version: "1.0.0";
  questions: LibraryQuestion[];
  activities: LibraryActivity[];
  resources: LibraryResource[];
}

export function exportLibraryItems(
  questions: LibraryQuestion[],
  activities: LibraryActivity[],
  resources: LibraryResource[],
): string {
  const pkg: LibraryExportPackage = {
    exportedAt: new Date().toISOString(),
    format: "nhc-library-export",
    version: "1.0.0",
    questions,
    activities,
    resources,
  };
  return JSON.stringify(pkg, null, 2);
}

export function parseLibraryImportJson(text: string): LibraryExportPackage {
  const parsed = JSON.parse(text);
  if (parsed.format !== "nhc-library-export") {
    throw new Error("Unrecognised library export format. Expected 'nhc-library-export'.");
  }
  return {
    exportedAt: String(parsed.exportedAt ?? ""),
    format: "nhc-library-export",
    version: "1.0.0",
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    resources: Array.isArray(parsed.resources) ? parsed.resources : [],
  };
}

export interface CsvQuestionRow {
  stable_key: string;
  title: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  marks: string;
  subject?: string;
  topic?: string;
  tags?: string;
  learning_outcomes?: string;
  [key: string]: string | undefined;
}

export function parseQuestionsCsv(csvText: string): LibraryQuestion[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return {
      id: "",
      stableKey: row.stable_key ?? "",
      title: row.title ?? "",
      questionText: row.question_text ?? "",
      questionType: row.question_type ?? "single",
      difficulty: Number(row.difficulty || 3),
      marks: Number(row.marks || 1),
      content: {},
      tags: row.tags ? row.tags.split(";").map((t) => t.trim()) : [],
      learningOutcomes: row.learning_outcomes ? row.learning_outcomes.split(";").map((lo) => lo.trim()) : [],
    };
  });
}

export function downloadLibraryExport(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
