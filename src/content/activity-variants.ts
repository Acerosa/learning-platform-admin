import { clonePackage } from "./clone.ts";
import { duplicateBlock, nextStableId } from "./factories.ts";
import type { ContentActivity, ContentPackage } from "./types.ts";

export const ACTIVITY_DIFFICULTIES = ["foundation", "standard", "challenge"] as const;
export type ActivityDifficulty = (typeof ACTIVITY_DIFFICULTIES)[number];

const DIFFICULTY_SUFFIX = /-(foundation|standard|challenge)$/;

export function activityFamilyId(activity: ContentActivity): string {
  const declared = String(activity.metadata.familyId || "").trim();
  if (declared) return declared;
  return activity.id.replace(DIFFICULTY_SUFFIX, "") || activity.id;
}

export function activityDifficulty(activity: ContentActivity): ActivityDifficulty {
  const value = String(activity.metadata.difficulty || "standard");
  return (ACTIVITY_DIFFICULTIES as readonly string[]).includes(value)
    ? value as ActivityDifficulty
    : "standard";
}

export function variantActivityId(familyId: string, difficulty: ActivityDifficulty, existingIds: readonly string[]) {
  const base = familyId.replace(DIFFICULTY_SUFFIX, "");
  const preferred = `${base}-${difficulty}`;
  if (!existingIds.includes(preferred)) return preferred;
  return nextStableId(preferred, existingIds);
}

export function duplicateActivityAsVariant(
  activity: ContentActivity,
  difficulty: ActivityDifficulty,
  existingIds: readonly string[],
): ContentActivity {
  const familyId = activityFamilyId(activity);
  const id = variantActivityId(familyId, difficulty, existingIds);
  const copy = structuredClone(activity);
  const blockIds: string[] = [];
  const blocks = (copy.blocks || []).map((block) => {
    const duplicated = duplicateBlock(block, id, blockIds);
    blockIds.push(duplicated.id);
    return duplicated;
  });
  return {
    ...copy,
    id,
    version: "0.1.0",
    metadata: {
      ...copy.metadata,
      title: `${String(copy.metadata.title || id)} (${difficulty})`,
      difficulty,
      familyId,
    },
    blocks,
  };
}

export function insertActivityVariant(pkg: ContentPackage, sourceId: string, difficulty: ActivityDifficulty): ContentPackage {
  const source = pkg.activities.find((item) => item.id === sourceId);
  if (!source) throw new Error("Select an activity before creating a variant.");
  const nextActivity = duplicateActivityAsVariant(source, difficulty, pkg.activities.map((item) => item.id));
  const next = clonePackage(pkg);
  next.activities = [...next.activities, nextActivity];
  next.sessions = next.sessions.map((session) => {
    const activities = Array.isArray(session.relationships.activities)
      ? [...session.relationships.activities as string[]]
      : [];
    if (activities.includes(source.id) && !activities.includes(nextActivity.id)) {
      activities.push(nextActivity.id);
      return { ...session, relationships: { ...session.relationships, activities } };
    }
    return session;
  });
  return next;
}

export function duplicateIndependentActivity(pkg: ContentPackage, sourceId: string): ContentPackage {
  const source = pkg.activities.find((item) => item.id === sourceId);
  if (!source) throw new Error("Select an activity to duplicate.");
  const copy = duplicateActivityAsVariant(
    source,
    activityDifficulty(source),
    pkg.activities.map((item) => item.id),
  );
  copy.metadata.familyId = `${activityFamilyId(source)}-copy`;
  copy.metadata.title = `${String(source.metadata.title || source.id)} copy`;
  const next = clonePackage(pkg);
  next.activities = [...next.activities, copy];
  return next;
}
