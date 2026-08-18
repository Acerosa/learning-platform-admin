export const LIFECYCLE_STATUSES = [
  "draft",
  "ready-for-review",
  "in-review",
  "approved",
  "published",
  "superseded",
  "archived",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const PLATFORM_PUBLICATION_STATES = [
  "idle",
  "pending",
  "publishing",
  "published",
  "failed",
] as const;

export type PlatformPublicationState = (typeof PLATFORM_PUBLICATION_STATES)[number];

export function idlePlatformPublication() {
  return {
    platformPublicationState: "idle" as const,
    platformPublicationError: null as string | null,
    platformPublishedAt: null as string | null,
    platformPublicationId: null as string | null,
  };
}

/** Validation result is not a lifecycle state. Legacy alias for editable drafts. */
export type DraftStatus = LifecycleStatus;

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface ContentDocument {
  schema: string;
  schemaVersion: string;
  id: string;
  version: string;
  metadata: Record<string, unknown>;
  relationships: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ContentBlock extends ContentDocument {
  type: string;
  content: Record<string, unknown>;
}

export interface ContentActivity extends ContentDocument {
  blocks: ContentBlock[];
}

export interface ContentPackage {
  hub: ContentDocument;
  curriculum: ContentDocument;
  learningOutcomes: ContentDocument[];
  assignments: ContentDocument[];
  weeks: ContentDocument[];
  sessions: ContentDocument[];
  activities: ContentActivity[];
  questions: ContentDocument[];
  assets: ContentDocument[];
}

export interface ReviewMetadata {
  status: LifecycleStatus;
  created: string;
  updated: string;
  author: string;
  reviewer: string;
  reviewDate: string | null;
  approvalNotes: string;
  publicationNotes: string;
}

export interface PublicationRecord {
  version: string;
  status: LifecycleStatus;
  created: string;
  published: string | null;
  publishedBy: string;
  sourcePackageVersion: string;
  schemaVersion: string;
}

export interface AuthoringDraft {
  id: string;
  title: string;
  hubId: string;
  courseKey: string;
  status: LifecycleStatus;
  version: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  author: string;
  reviewer: string;
  reviewDate: string | null;
  approvalNotes: string;
  publicationNotes: string;
  publishedBy: string;
  sourcePackageVersion: string;
  schemaVersion: string;
  basedOnVersionId: string | null;
  basedOnVersion: string | null;
  platformPublicationState: PlatformPublicationState;
  platformPublicationError: string | null;
  platformPublishedAt: string | null;
  platformPublicationId: string | null;
  remoteRevision: number;
  saveStatus?: "idle" | "unsaved" | "saving" | "saved" | "failed" | "offline";
  package: ContentPackage;
}

export interface ContentEngine {
  SCHEMA_VERSION: string;
  SCHEMAS: Record<string, string>;
  SESSION_KINDS: readonly string[];
  STATUSES: readonly string[];
  BLOCK_TYPES: readonly { id: string; category: string; implemented: boolean }[];
  INTERACTIVE_BLOCK_TYPES: readonly string[];
  EXCEL_SHEET_NAMES: readonly string[];
  normaliseBlockType(value: string): string;
  isRegisteredBlockType(value: string): boolean;
  isInteractiveBlockType(value: string): boolean;
  getBlockType(value: string): { id: string; implemented: boolean } | null;
  normaliseBlock(block: unknown): ContentBlock;
  validateDocument(doc: unknown, expectedSchema?: string): ValidationIssue[];
  validatePackage(pkg: ContentPackage): { valid: boolean; issues: ValidationIssue[] };
  formatIssues(issues: ValidationIssue[]): string;
  loadPackageFromFiles(files: Partial<ContentPackage> & { hub?: unknown; curriculum?: unknown }): ContentPackage;
  importJSON(value: unknown): ContentPackage;
  importFromSheets(sheets: Record<string, unknown>): ContentPackage;
  importFromCsvSheets(csvByName: Record<string, string>, hub: unknown, curriculum: unknown): ContentPackage;
  parseCsvSheet(text: string): Record<string, string>[];
  containsUnsafeMarkup(value: string): boolean;
  sanitizeImportedText(value: unknown): string;
  sanitiseContent(value: unknown): unknown;
  renderActivity(activity: unknown, options?: { root?: string }): string;
  renderWeek(resolved: unknown, options?: { root?: string }): string;
  resolveWeek(pkg: ContentPackage, weekId: string): unknown;
  resolveActivity(pkg: ContentPackage, activityId: string): unknown;
}
