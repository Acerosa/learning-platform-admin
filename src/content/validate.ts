import { getContentEngine } from "./engine.ts";
import type { ContentPackage, ValidationIssue } from "./types";

export function validatePackage(pkg: ContentPackage) {
  return getContentEngine().validatePackage(pkg);
}

export function validateDocument(doc: unknown, expectedSchema?: string): ValidationIssue[] {
  return getContentEngine().validateDocument(doc, expectedSchema);
}

export function previewActivityHtml(activity: unknown) {
  return getContentEngine().renderActivity(activity, { root: "." });
}

export function previewWeekHtml(pkg: ContentPackage, weekId: string) {
  const engine = getContentEngine();
  const resolved = engine.resolveWeek(pkg, weekId);
  if (!resolved) return "<p>Week is not in this draft.</p>";
  return engine.renderWeek(resolved, { root: "." });
}
