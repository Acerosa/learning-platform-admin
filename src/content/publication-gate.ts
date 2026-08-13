import { getContentEngine } from "./engine.ts";
import type { ContentDocument, ContentPackage, ValidationIssue } from "./types";
import { validatePackage } from "./validate.ts";

export const CONTENT_PACKAGE_VERSION = "0.1.0";
export const SUPPORTED_CONTENT_PACKAGE_VERSIONS = ["0.1.0"] as const;

function collectDocuments(pkg: ContentPackage): ContentDocument[] {
  return [
    pkg.hub,
    pkg.curriculum,
    ...pkg.learningOutcomes,
    ...pkg.assignments,
    ...pkg.weeks,
    ...pkg.sessions,
    ...pkg.activities,
    ...pkg.activities.flatMap((activity) => activity.blocks || []),
    ...pkg.questions,
    ...pkg.assets,
  ];
}

export function publicationGate(
  pkg: ContentPackage,
  sourcePackageVersion = CONTENT_PACKAGE_VERSION,
): { ok: boolean; issues: ValidationIssue[] } {
  const engine = getContentEngine();
  const issues: ValidationIssue[] = [...validatePackage(pkg).issues];
  const supportedSchema = engine.SCHEMA_VERSION;

  if (!SUPPORTED_CONTENT_PACKAGE_VERSIONS.includes(sourcePackageVersion as typeof SUPPORTED_CONTENT_PACKAGE_VERSIONS[number])) {
    issues.push({
      code: "UNSUPPORTED_PACKAGE_VERSION",
      path: "sourcePackageVersion",
      message: `Package version ${sourcePackageVersion} is not supported. Supported: ${SUPPORTED_CONTENT_PACKAGE_VERSIONS.join(", ")}.`,
    });
  }

  collectDocuments(pkg).forEach((doc, index) => {
    if (!doc) return;
    if (doc.schemaVersion && doc.schemaVersion !== supportedSchema) {
      issues.push({
        code: "UNSUPPORTED_SCHEMA_VERSION",
        path: `${doc.schema || "document"}[${doc.id || index}].schemaVersion`,
        message: `Schema version ${doc.schemaVersion} is not supported. Supported: ${supportedSchema}.`,
      });
    }
  });

  return { ok: issues.length === 0, issues };
}
