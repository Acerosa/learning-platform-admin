import { clonePackage, deepFreeze } from "./clone.ts";
import { getContentEngine } from "./engine.ts";
import { slugify } from "./factories.ts";
import { isLifecycleStatus, isImmutableStatus } from "./lifecycle.ts";
import { CONTENT_PACKAGE_VERSION } from "./publication-gate.ts";
import { sanitizeObject } from "./sanitize.ts";
import {
  idlePlatformPublication,
  PLATFORM_PUBLICATION_STATES,
  type AuthoringDraft,
  type ContentActivity,
  type ContentDocument,
  type ContentPackage,
  type LifecycleStatus,
  type PlatformPublicationState,
} from "./types.ts";
import { createDraft, touchDraft } from "./versioning.ts";

export { createDraft, touchDraft };

const STORAGE_KEY_V1 = "lp.admin.authoring.drafts.v1";
const STORAGE_KEY = "lp.admin.authoring.records.v2";

const LEGACY_STATUS: Record<string, LifecycleStatus> = {
  draft: "draft",
  valid: "draft",
  invalid: "draft",
  "ready-for-review": "ready-for-review",
};

function now() {
  return new Date().toISOString();
}

function migratePlatformState(value: unknown): PlatformPublicationState {
  return (PLATFORM_PUBLICATION_STATES as readonly string[]).includes(String(value))
    ? value as PlatformPublicationState
    : "idle";
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function migrateRecord(raw: unknown): AuthoringDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<AuthoringDraft> & { package?: ContentPackage; status?: string };
  if (!value.id || !value.package) return null;
  const status = isLifecycleStatus(value.status || "")
    ? value.status as LifecycleStatus
    : LEGACY_STATUS[value.status || ""] || "draft";
  const createdAt = value.createdAt || now();
  return {
    id: value.id,
    title: value.title || "Untitled draft",
    hubId: value.hubId || String(value.package.hub?.id || "hub"),
    courseKey: value.courseKey || String(value.package.curriculum?.metadata?.course || "course"),
    status,
    version: value.version || "",
    createdAt,
    updatedAt: value.updatedAt || createdAt,
    publishedAt: value.publishedAt || null,
    author: value.author || "local-author",
    reviewer: value.reviewer || "",
    reviewDate: value.reviewDate || null,
    approvalNotes: value.approvalNotes || "",
    publicationNotes: value.publicationNotes || "",
    publishedBy: value.publishedBy || "",
    sourcePackageVersion: value.sourcePackageVersion || CONTENT_PACKAGE_VERSION,
    schemaVersion: value.schemaVersion || value.package.hub?.schemaVersion || CONTENT_PACKAGE_VERSION,
    basedOnVersionId: value.basedOnVersionId || null,
    basedOnVersion: value.basedOnVersion || null,
    platformPublicationState: migratePlatformState(value.platformPublicationState),
    platformPublicationError: value.platformPublicationError || null,
    platformPublishedAt: value.platformPublishedAt || null,
    platformPublicationId: value.platformPublicationId || null,
    package: value.package,
  };
}

function readStorage(key: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sealRecord(record: AuthoringDraft): AuthoringDraft {
  if (!isImmutableStatus(record.status)) return record;
  return { ...record, package: deepFreeze(clonePackage(record.package)) };
}

export function loadDrafts(): AuthoringDraft[] {
  const current = readStorage(STORAGE_KEY).map(migrateRecord).filter((item): item is AuthoringDraft => Boolean(item)).map(sealRecord);
  if (current.length) return current;
  const legacy = readStorage(STORAGE_KEY_V1).map(migrateRecord).filter((item): item is AuthoringDraft => Boolean(item)).map(sealRecord);
  if (legacy.length) persistDrafts(legacy);
  return legacy;
}

export function persistDrafts(drafts: AuthoringDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function saveDraft(drafts: AuthoringDraft[], draft: AuthoringDraft) {
  const next = [draft, ...drafts.filter((item) => item.id !== draft.id)];
  persistDrafts(next);
  return next;
}

export function deleteDraft(drafts: AuthoringDraft[], id: string) {
  const target = drafts.find((item) => item.id === id);
  if (target && isImmutableStatus(target.status)) {
    return drafts;
  }
  const next = drafts.filter((item) => item.id !== id);
  persistDrafts(next);
  return next;
}

export function duplicateDraft(draft: AuthoringDraft): AuthoringDraft {
  const createdAt = now();
  return {
    ...draft,
    id: randomId(),
    title: `${draft.title} copy`,
    status: "draft",
    version: "",
    createdAt,
    updatedAt: createdAt,
    publishedAt: null,
    publishedBy: "",
    publicationNotes: "",
    approvalNotes: "",
    reviewer: "",
    reviewDate: null,
    basedOnVersionId: null,
    basedOnVersion: null,
    ...idlePlatformPublication(),
  };
}

export function importToPackage(value: unknown, fallbackHub: ContentPackage["hub"], fallbackCurriculum: ContentPackage["curriculum"]) {
  const engine = getContentEngine();
  const clean = sanitizeObject(value);
  let pkg: ContentPackage;
  if (clean && typeof clean === "object" && "schema" in (clean as object)) {
    const doc = clean as { schema?: string };
    if (doc.schema === engine.SCHEMAS.ACTIVITY) {
      pkg = engine.loadPackageFromFiles({
        hub: fallbackHub,
        curriculum: fallbackCurriculum,
        activities: [clean as ContentActivity],
      });
    } else if (doc.schema === engine.SCHEMAS.WEEK) {
      pkg = engine.loadPackageFromFiles({
        hub: fallbackHub,
        curriculum: fallbackCurriculum,
        weeks: [clean as ContentDocument],
      });
    } else if (doc.schema === engine.SCHEMAS.SESSION) {
      pkg = engine.loadPackageFromFiles({
        hub: fallbackHub,
        curriculum: fallbackCurriculum,
        sessions: [clean as ContentDocument],
      });
    } else {
      pkg = engine.importJSON(clean);
    }
  } else {
    pkg = engine.importJSON(clean);
  }
  if (!pkg.hub) pkg.hub = fallbackHub;
  if (!pkg.curriculum) pkg.curriculum = fallbackCurriculum;
  return pkg;
}

export function mergePackages(base: ContentPackage, incoming: ContentPackage): ContentPackage {
  const mergeById = <T extends { id: string }>(current: T[], extra: T[]) => {
    const map = new Map(current.map((item) => [item.id, item]));
    extra.forEach((item) => map.set(item.id, item));
    return [...map.values()];
  };
  return {
    hub: incoming.hub || base.hub,
    curriculum: incoming.curriculum || base.curriculum,
    learningOutcomes: mergeById(base.learningOutcomes, incoming.learningOutcomes || []),
    assignments: mergeById(base.assignments, incoming.assignments || []),
    weeks: mergeById(base.weeks, incoming.weeks || []),
    sessions: mergeById(base.sessions, incoming.sessions || []),
    activities: mergeById(base.activities, incoming.activities || []),
    questions: mergeById(base.questions, incoming.questions || []),
    assets: mergeById(base.assets, incoming.assets || []),
  };
}

export function suggestedActivityFileName(pkg: ContentPackage) {
  const activity = pkg.activities[0];
  return `${slugify(activity?.id || "activity", "activity")}.json`;
}
