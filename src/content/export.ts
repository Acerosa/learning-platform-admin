import type { ContentActivity, ContentDocument, ContentPackage } from "./types";

export function exportDocument(doc: ContentDocument | ContentActivity) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function exportPackage(pkg: ContentPackage) {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function exportActivityPackage(pkg: ContentPackage, activityId?: string) {
  const activity = activityId
    ? pkg.activities.find((item) => item.id === activityId)
    : pkg.activities[0];
  if (!activity) {
    throw new Error("No activity to export.");
  }
  return exportPackage({
    hub: pkg.hub,
    curriculum: pkg.curriculum,
    learningOutcomes: pkg.learningOutcomes,
    assignments: pkg.assignments,
    weeks: pkg.weeks,
    sessions: pkg.sessions,
    activities: [activity],
    questions: pkg.questions,
    assets: pkg.assets,
  });
}

export function downloadText(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
