export type DraftStatus = "draft" | "valid" | "invalid" | "ready-for-review";

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

export interface AuthoringDraft {
  id: string;
  title: string;
  hubId: string;
  courseKey: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
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
