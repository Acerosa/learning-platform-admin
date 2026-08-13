import { getContentEngine } from "./engine.ts";
import { emptyPackage, slugify } from "./factories.ts";
import { sanitizeObject } from "./sanitize.ts";
import type { AuthoringDraft, ContentActivity, ContentDocument, ContentPackage, DraftStatus } from "./types";
import { validatePackage } from "./validate.ts";

const STORAGE_KEY = "lp.admin.authoring.drafts.v1";

function now() {
  return new Date().toISOString();
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveStatus(pkg: ContentPackage, current: DraftStatus): DraftStatus {
  if (current === "draft") return "draft";
  const result = validatePackage(pkg);
  if (!result.valid) return "invalid";
  if (current === "ready-for-review") return "ready-for-review";
  return "valid";
}

export function createDraft(hubId: string, hubName: string, courseKey: string): AuthoringDraft {
  const createdAt = now();
  return {
    id: randomId(),
    title: `${hubName} draft`,
    hubId,
    courseKey,
    status: "draft",
    createdAt,
    updatedAt: createdAt,
    package: emptyPackage(hubId, hubName, courseKey),
  };
}

export function touchDraft(draft: AuthoringDraft, pkg: ContentPackage, status?: DraftStatus): AuthoringDraft {
  return {
    ...draft,
    package: pkg,
    status: status || deriveStatus(pkg, draft.status === "ready-for-review" ? "valid" : "draft"),
    updatedAt: now(),
    hubId: String(pkg.hub.id),
    courseKey: String(pkg.curriculum.metadata.course || draft.courseKey),
    title: String(pkg.curriculum.metadata.title || draft.title),
  };
}

export function loadDrafts(): AuthoringDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuthoringDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    createdAt,
    updatedAt: createdAt,
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
