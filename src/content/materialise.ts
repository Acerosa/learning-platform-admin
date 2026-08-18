import { clonePackage } from "./clone.ts";
import { syncCurriculumLists } from "./factories.ts";
import type { AuthoringDraft, ContentActivity, ContentPackage } from "./types.ts";
import type { CompositionDraft, CompositionReference } from "./composition-engine.ts";
import { createDraft, touchDraft } from "./versioning.ts";

// ─── Materialisation ─────────────────────────────────────────────────────────
// Transforms a CompositionDraft into a canonical ContentPackage suitable for
// the existing draft/publication pipeline. All library references are resolved,
// overrides applied, and _compositionRef metadata stripped.

function resolveActivityOverrides(
  activity: ContentActivity,
  ref: CompositionReference | undefined,
): ContentActivity {
  if (!ref || ref.state === "inherited") {
    return stripCompositionMetadata(activity);
  }

  if (ref.state === "detached") {
    return stripCompositionMetadata(activity);
  }

  const resolved = { ...activity };
  const metadata = { ...resolved.metadata };

  for (const [key, value] of Object.entries(ref.overrides)) {
    metadata[key] = value;
  }

  resolved.metadata = metadata;
  return stripCompositionMetadata(resolved);
}

function stripCompositionMetadata(activity: ContentActivity): ContentActivity {
  if (!activity.metadata._compositionRef) return activity;
  const metadata = { ...activity.metadata };
  delete metadata._compositionRef;
  return { ...activity, metadata };
}

export function materialise(composition: CompositionDraft): ContentPackage {
  const pkg = clonePackage(composition.package);

  const refMap = new Map<string, CompositionReference>();
  for (const ref of composition.references) {
    refMap.set(ref.instanceId, ref);
  }

  pkg.activities = pkg.activities.map((activity) => {
    const ref = refMap.get(activity.id);
    return resolveActivityOverrides(activity, ref);
  });

  return syncCurriculumLists(pkg);
}

// ─── Draft Integration ───────────────────────────────────────────────────────
// Creates or updates a standard AuthoringDraft from a CompositionDraft,
// feeding into the existing publication pipeline.

export function compositionToDraft(
  composition: CompositionDraft,
  hubId: string,
  hubName: string,
  courseKey: string,
  actor: string,
  existingDraft?: AuthoringDraft | null,
): AuthoringDraft {
  const resolvedPackage = materialise(composition);

  if (existingDraft && existingDraft.status === "draft") {
    return touchDraft(existingDraft, resolvedPackage);
  }

  const draft = createDraft(hubId, hubName, courseKey, actor);
  return touchDraft(draft, resolvedPackage);
}

export function updateDraftFromComposition(
  draft: AuthoringDraft,
  composition: CompositionDraft,
): AuthoringDraft {
  if (draft.status !== "draft") {
    throw new Error("Cannot update a non-draft record. Return to draft status first.");
  }
  const resolvedPackage = materialise(composition);
  return touchDraft(draft, resolvedPackage);
}

// ─── Draft Comparison ────────────────────────────────────────────────────────

export interface PackageDiff {
  addedActivities: string[];
  removedActivities: string[];
  changedActivities: string[];
  addedWeeks: string[];
  removedWeeks: string[];
  addedSessions: string[];
  removedSessions: string[];
  addedQuestions: string[];
  removedQuestions: string[];
  metadataChanges: { field: string; oldValue: unknown; newValue: unknown }[];
}

export function comparePackages(
  current: ContentPackage,
  previous: ContentPackage,
): PackageDiff {
  const currentActivityIds = new Set(current.activities.map((a) => a.id));
  const previousActivityIds = new Set(previous.activities.map((a) => a.id));

  const addedActivities = current.activities
    .filter((a) => !previousActivityIds.has(a.id))
    .map((a) => a.id);
  const removedActivities = previous.activities
    .filter((a) => !currentActivityIds.has(a.id))
    .map((a) => a.id);

  const changedActivities: string[] = [];
  for (const act of current.activities) {
    const prev = previous.activities.find((a) => a.id === act.id);
    if (!prev) continue;
    if (
      JSON.stringify(act.blocks) !== JSON.stringify(prev.blocks) ||
      JSON.stringify(act.metadata) !== JSON.stringify(prev.metadata)
    ) {
      changedActivities.push(act.id);
    }
  }

  const currentWeekIds = new Set(current.weeks.map((w) => w.id));
  const previousWeekIds = new Set(previous.weeks.map((w) => w.id));
  const addedWeeks = current.weeks.filter((w) => !previousWeekIds.has(w.id)).map((w) => w.id);
  const removedWeeks = previous.weeks.filter((w) => !currentWeekIds.has(w.id)).map((w) => w.id);

  const currentSessionIds = new Set(current.sessions.map((s) => s.id));
  const previousSessionIds = new Set(previous.sessions.map((s) => s.id));
  const addedSessions = current.sessions.filter((s) => !previousSessionIds.has(s.id)).map((s) => s.id);
  const removedSessions = previous.sessions.filter((s) => !currentSessionIds.has(s.id)).map((s) => s.id);

  const currentQuestionIds = new Set(current.questions.map((q) => q.id));
  const previousQuestionIds = new Set(previous.questions.map((q) => q.id));
  const addedQuestions = current.questions.filter((q) => !previousQuestionIds.has(q.id)).map((q) => q.id);
  const removedQuestions = previous.questions.filter((q) => !currentQuestionIds.has(q.id)).map((q) => q.id);

  const metadataChanges: PackageDiff["metadataChanges"] = [];
  const currMeta = current.curriculum.metadata;
  const prevMeta = previous.curriculum.metadata;
  for (const key of new Set([...Object.keys(currMeta), ...Object.keys(prevMeta)])) {
    if (JSON.stringify(currMeta[key]) !== JSON.stringify(prevMeta[key])) {
      metadataChanges.push({ field: key, oldValue: prevMeta[key], newValue: currMeta[key] });
    }
  }

  return {
    addedActivities,
    removedActivities,
    changedActivities,
    addedWeeks,
    removedWeeks,
    addedSessions,
    removedSessions,
    addedQuestions,
    removedQuestions,
    metadataChanges,
  };
}

// ─── Package Preview ─────────────────────────────────────────────────────────

export function previewPackageJson(composition: CompositionDraft): string {
  const pkg = materialise(composition);
  return JSON.stringify(pkg, null, 2);
}
