import { clonePackage } from "./clone.ts";
import {
  createActivity,
  createSession,
  createWeek,
  nextStableId,
  slugify,
} from "./factories.ts";
import type {
  ContentActivity,
  ContentBlock,
  ContentDocument,
  ContentPackage,
} from "./types.ts";
import type { LibraryQuestion, LibraryResource } from "./library-reuse.ts";

export type CompositionState = "inherited" | "overridden" | "detached";

export interface CompositionReference {
  instanceId: string;
  libraryType: "question" | "activity" | "resource" | "template" | "feedback" | "hint";
  libraryItemId: string;
  libraryVersion: string;
  state: CompositionState;
  overrides: Record<string, unknown>;
}

export interface CompositionDraft {
  package: ContentPackage;
  references: CompositionReference[];
}

export interface ActivitySlotSpec {
  type: string;
  label: string;
  estimatedDurationMinutes?: number | null;
  required?: boolean;
  difficulty?: "foundation" | "standard" | "challenge";
  learningIntent?: string | null;
  learningOutcome?: string | null;
  libraryFilters?: Record<string, unknown>;
}

export interface CompositionTemplateSessionSpec {
  title: string;
  kind: string;
  estimatedDurationMinutes?: number | null;
  activitySlots: ActivitySlotSpec[];
}

export interface CompositionTemplateSpec {
  weekTitle: string;
  description?: string | null;
  status?: "draft" | "published" | "superseded" | "archived";
  tags?: string[];
  learningIntent?: string | null;
  estimatedDurationMinutes?: number | null;
  sessions: CompositionTemplateSessionSpec[];
}

export interface RecipeSpec {
  title: string;
  kind: string;
  description?: string | null;
  status?: "draft" | "published" | "superseded" | "archived";
  tags?: string[];
  estimatedDurationMinutes?: number | null;
  slots: ActivitySlotSpec[];
}

export interface CustomTemplateRecord {
  id: string;
  stableKey: string;
  title: string;
  templateType: string;
  description: string | null;
  specification: CompositionTemplateSpec;
  tags: string[];
  status: string;
  version: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomRecipeRecord {
  id: string;
  stableKey: string;
  title: string;
  recipeType: string;
  description: string | null;
  specification: RecipeSpec;
  tags: string[];
  status: string;
  version: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryActivityInsert {
  stableKey: string;
  libraryId: string;
  title: string;
  activityType: string;
  difficulty: "foundation" | "standard" | "challenge";
  familyId: string | null;
  summary: string | null;
  version: string;
  learningOutcomes: string[];
  blocks: ContentBlock[];
  estimatedDurationMinutes?: number | null;
  learningIntent?: string | null;
}

export function insertActivityFromLibrary(
  draft: CompositionDraft,
  sessionId: string,
  libraryActivity: LibraryActivityInsert,
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const existingIds = pkg.activities.map((a) => a.id);
  const instanceId = nextStableId(libraryActivity.stableKey, existingIds);

  const activity: ContentActivity = {
    schema: "lp.content.activity",
    schemaVersion: "0.1.0",
    id: instanceId,
    version: "0.1.0",
    metadata: {
      title: libraryActivity.title,
      status: "available",
      activityType: libraryActivity.activityType,
      difficulty: libraryActivity.difficulty,
      familyId: libraryActivity.familyId,
      summary: libraryActivity.summary,
      estimatedDurationMinutes: normaliseDuration(libraryActivity.estimatedDurationMinutes),
      learningIntent: libraryActivity.learningIntent ?? null,
      _compositionRef: {
        libraryId: libraryActivity.libraryId,
        libraryVersion: libraryActivity.version,
        state: "inherited",
      },
    },
    relationships: {
      learningOutcomes: libraryActivity.learningOutcomes,
      assignment: "formative-practice",
      questions: [],
      assets: [],
    },
    blocks: libraryActivity.blocks,
  };

  pkg.activities = [...pkg.activities, activity];

  const sessionIdx = pkg.sessions.findIndex((s) => s.id === sessionId);
  if (sessionIdx >= 0) {
    const session = { ...pkg.sessions[sessionIdx] };
    const activities = Array.isArray(session.relationships.activities)
      ? [...(session.relationships.activities as string[])]
      : [];
    activities.push(instanceId);
    session.relationships = { ...session.relationships, activities };
    pkg.sessions[sessionIdx] = session;
  }

  const ref: CompositionReference = {
    instanceId,
    libraryType: "activity",
    libraryItemId: libraryActivity.libraryId,
    libraryVersion: libraryActivity.version,
    state: "inherited",
    overrides: {},
  };

  return {
    package: pkg,
    references: [...draft.references, ref],
  };
}

export function insertQuestionFromLibrary(
  draft: CompositionDraft,
  activityId: string,
  question: LibraryQuestion,
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const actIdx = pkg.activities.findIndex((a) => a.id === activityId);
  if (actIdx < 0) throw new Error(`Activity ${activityId} not found.`);

  const activity = { ...pkg.activities[actIdx] };
  const block = questionToBlock(question, activityId);
  activity.blocks = [...activity.blocks, block];
  pkg.activities[actIdx] = activity;

  const ref: CompositionReference = {
    instanceId: block.id,
    libraryType: "question",
    libraryItemId: question.id,
    libraryVersion: "1.0.0",
    state: "inherited",
    overrides: {},
  };

  return {
    package: pkg,
    references: [...draft.references, ref],
  };
}

export function attachResourceFromLibrary(
  draft: CompositionDraft,
  activityId: string,
  resource: LibraryResource,
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const actIdx = pkg.activities.findIndex((a) => a.id === activityId);
  if (actIdx < 0) throw new Error(`Activity ${activityId} not found.`);

  const activity = { ...pkg.activities[actIdx] };
  const blockId = `${activityId}:resource-${resource.stableKey}`;
  const block: ContentBlock = {
    schema: "lp.content.block",
    schemaVersion: "0.1.0",
    id: blockId,
    version: "1.0.0",
    type: "reference",
    metadata: {},
    relationships: {},
    content: {
      title: resource.title,
      resourceType: resource.resourceType,
      url: resource.url,
      description: resource.description,
    },
  };
  activity.blocks = [...activity.blocks, block];
  pkg.activities[actIdx] = activity;

  const ref: CompositionReference = {
    instanceId: blockId,
    libraryType: "resource",
    libraryItemId: resource.id,
    libraryVersion: "1.0.0",
    state: "inherited",
    overrides: {},
  };

  return {
    package: pkg,
    references: [...draft.references, ref],
  };
}

export function reorderActivities(
  draft: CompositionDraft,
  sessionId: string,
  orderedActivityIds: string[],
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const sessionIdx = pkg.sessions.findIndex((s) => s.id === sessionId);
  if (sessionIdx < 0) throw new Error(`Session ${sessionId} not found.`);

  const session = { ...pkg.sessions[sessionIdx] };
  session.relationships = { ...session.relationships, activities: orderedActivityIds };
  pkg.sessions[sessionIdx] = session;

  return { package: pkg, references: draft.references };
}

export function reorderQuestions(
  draft: CompositionDraft,
  activityId: string,
  orderedBlockIds: string[],
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const actIdx = pkg.activities.findIndex((a) => a.id === activityId);
  if (actIdx < 0) throw new Error(`Activity ${activityId} not found.`);

  const activity = { ...pkg.activities[actIdx] };
  const blockMap = new Map(activity.blocks.map((b) => [b.id, b]));
  const reordered = orderedBlockIds
    .map((id) => blockMap.get(id))
    .filter((b): b is ContentBlock => b != null);
  const remaining = activity.blocks.filter((b) => !orderedBlockIds.includes(b.id));
  activity.blocks = [...reordered, ...remaining];
  pkg.activities[actIdx] = activity;

  return { package: pkg, references: draft.references };
}

export function reorderWeeks(
  draft: CompositionDraft,
  orderedWeekIds: string[],
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const weekMap = new Map(pkg.weeks.map((week) => [week.id, week]));
  const reordered = orderedWeekIds
    .map((id) => weekMap.get(id))
    .filter((week): week is ContentDocument => week != null);
  const remaining = pkg.weeks.filter((week) => !orderedWeekIds.includes(week.id));
  pkg.weeks = [...reordered, ...remaining];
  return { package: pkg, references: draft.references };
}

export function reorderSessions(
  draft: CompositionDraft,
  weekId: string,
  orderedSessionIds: string[],
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const weekIdx = pkg.weeks.findIndex((week) => week.id === weekId);
  if (weekIdx < 0) throw new Error(`Week ${weekId} not found.`);
  const week = { ...pkg.weeks[weekIdx] };
  week.relationships = { ...week.relationships, sessions: orderedSessionIds };
  pkg.weeks[weekIdx] = week;
  return { package: pkg, references: draft.references };
}

export function applyOverride(
  draft: CompositionDraft,
  instanceId: string,
  field: string,
  value: unknown,
): CompositionDraft {
  const refs = draft.references.map((r) => {
    if (r.instanceId === instanceId && r.state !== "detached") {
      return {
        ...r,
        state: "overridden" as const,
        overrides: { ...r.overrides, [field]: value },
      };
    }
    return r;
  });
  return { package: draft.package, references: refs };
}

export function clearOverride(
  draft: CompositionDraft,
  instanceId: string,
  field: string,
): CompositionDraft {
  const refs = draft.references.map((r) => {
    if (r.instanceId === instanceId) {
      const overrides = { ...r.overrides };
      delete overrides[field];
      const state = Object.keys(overrides).length === 0 ? "inherited" : "overridden";
      return { ...r, state: state as CompositionState, overrides };
    }
    return r;
  });
  return { package: draft.package, references: refs };
}

export function detachFromLibrary(
  draft: CompositionDraft,
  instanceId: string,
): CompositionDraft {
  const refs = draft.references.map((r) => {
    if (r.instanceId === instanceId) {
      return { ...r, state: "detached" as const };
    }
    return r;
  });
  return { package: draft.package, references: refs };
}

export interface UpdateAvailable {
  instanceId: string;
  libraryType: string;
  currentVersion: string;
  latestVersion: string;
}

export function findUpdatesAvailable(
  draft: CompositionDraft,
  libraryVersions: Map<string, string>,
): UpdateAvailable[] {
  return draft.references
    .filter((r) => r.state !== "detached")
    .filter((r) => {
      const latest = libraryVersions.get(`${r.libraryType}:${r.libraryItemId}`);
      return latest != null && latest !== r.libraryVersion;
    })
    .map((r) => ({
      instanceId: r.instanceId,
      libraryType: r.libraryType,
      currentVersion: r.libraryVersion,
      latestVersion: libraryVersions.get(`${r.libraryType}:${r.libraryItemId}`) ?? r.libraryVersion,
    }));
}

export function acceptUpdate(
  draft: CompositionDraft,
  instanceId: string,
  newVersion: string,
  updatedContent?: Partial<ContentActivity>,
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const refs = draft.references.map((r) => {
    if (r.instanceId === instanceId && r.state !== "detached") {
      return { ...r, libraryVersion: newVersion, overrides: {}, state: "inherited" as const };
    }
    return r;
  });

  if (updatedContent) {
    const actIdx = pkg.activities.findIndex((a) => a.id === instanceId);
    if (actIdx >= 0) {
      pkg.activities[actIdx] = { ...pkg.activities[actIdx], ...updatedContent };
    }
  }

  return { package: pkg, references: refs };
}

export function ignoreUpdate(
  draft: CompositionDraft,
  _instanceId: string,
): CompositionDraft {
  return draft;
}

export interface DiffResult {
  addedBlocks: ContentBlock[];
  removedBlocks: ContentBlock[];
  changedBlocks: { blockId: string; field: string; oldValue: unknown; newValue: unknown }[];
  metadataChanges: { field: string; oldValue: unknown; newValue: unknown }[];
}

export function compareActivities(
  current: ContentActivity,
  updated: ContentActivity,
): DiffResult {
  const currentBlockIds = new Set(current.blocks.map((b) => b.id));
  const updatedBlockIds = new Set(updated.blocks.map((b) => b.id));

  const addedBlocks = updated.blocks.filter((b) => !currentBlockIds.has(b.id));
  const removedBlocks = current.blocks.filter((b) => !updatedBlockIds.has(b.id));

  const changedBlocks: DiffResult["changedBlocks"] = [];
  for (const cb of current.blocks) {
    const ub = updated.blocks.find((b) => b.id === cb.id);
    if (!ub) continue;
    for (const key of new Set([...Object.keys(cb.content), ...Object.keys(ub.content)])) {
      const oldVal = cb.content[key];
      const newVal = ub.content[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedBlocks.push({ blockId: cb.id, field: key, oldValue: oldVal, newValue: newVal });
      }
    }
  }

  const metadataChanges: DiffResult["metadataChanges"] = [];
  for (const key of new Set([...Object.keys(current.metadata), ...Object.keys(updated.metadata)])) {
    if (key === "_compositionRef") continue;
    const oldVal = current.metadata[key];
    const newVal = updated.metadata[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      metadataChanges.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return { addedBlocks, removedBlocks, changedBlocks, metadataChanges };
}

export interface CoverageResult {
  learningOutcomes: { id: string; percentage: number; activityCount: number }[];
  missing: string[];
  duplicated: string[];
}

export function analyseCoverage(
  pkg: ContentPackage,
  declaredOutcomes: string[],
): CoverageResult {
  const outcomeCounts = new Map<string, number>();
  for (const activity of pkg.activities) {
    const los = Array.isArray(activity.relationships.learningOutcomes)
      ? (activity.relationships.learningOutcomes as string[])
      : [];
    for (const lo of los) {
      outcomeCounts.set(lo, (outcomeCounts.get(lo) || 0) + 1);
    }
  }

  const totalActivities = pkg.activities.length || 1;
  const learningOutcomes = declaredOutcomes.map((id) => ({
    id,
    activityCount: outcomeCounts.get(id) || 0,
    percentage: Math.round(((outcomeCounts.get(id) || 0) / totalActivities) * 100),
  }));

  const missing = declaredOutcomes.filter((id) => !outcomeCounts.has(id));
  const duplicated = declaredOutcomes.filter((id) => (outcomeCounts.get(id) || 0) > 3);

  return { learningOutcomes, missing, duplicated };
}

export interface DifficultyBalance {
  foundation: number;
  standard: number;
  challenge: number;
  total: number;
}

export function analyseDifficultyBalance(pkg: ContentPackage): DifficultyBalance {
  let foundation = 0;
  let standard = 0;
  let challenge = 0;

  for (const activity of pkg.activities) {
    const diff = String(activity.metadata.difficulty || "standard");
    if (diff === "foundation") foundation += 1;
    else if (diff === "challenge") challenge += 1;
    else standard += 1;
  }

  const total = foundation + standard + challenge;
  return { foundation, standard, challenge, total };
}

export interface SessionStats {
  estimatedDuration: number | null;
  knownDurationMinutes: number;
  unknownDurationActivityCount: number;
  hasUnknownDuration: boolean;
  totalMarks: number;
  questionCount: number;
  activityCount: number;
  practicalCount: number;
  resourceCount: number;
}

export function computeSessionStats(
  pkg: ContentPackage,
  sessionId: string,
  references: CompositionReference[] = [],
): SessionStats {
  const session = pkg.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return {
      estimatedDuration: 0,
      knownDurationMinutes: 0,
      unknownDurationActivityCount: 0,
      hasUnknownDuration: false,
      totalMarks: 0,
      questionCount: 0,
      activityCount: 0,
      practicalCount: 0,
      resourceCount: 0,
    };
  }

  const activityIds = Array.isArray(session.relationships.activities)
    ? (session.relationships.activities as string[])
    : [];
  const activities = activityIds
    .map((id) => pkg.activities.find((a) => a.id === id))
    .filter((a): a is ContentActivity => a != null);

  let questionCount = 0;
  let practicalCount = 0;
  let resourceCount = 0;
  let totalMarks = 0;
  let knownDurationMinutes = 0;
  let unknownDurationActivityCount = 0;
  const refMap = new Map(references.map((reference) => [reference.instanceId, reference]));

  for (const activity of activities) {
    const duration = resolveActivityEstimatedDuration(activity, refMap.get(activity.id));
    if (duration == null) {
      unknownDurationActivityCount += 1;
    } else {
      knownDurationMinutes += duration;
    }
    for (const block of activity.blocks) {
      if (block.content.questionId) questionCount += 1;
      if (block.type === "code-editor" || block.type === "python-exercise") practicalCount += 1;
      if (block.type === "reference") resourceCount += 1;
      if (typeof block.content.marks === "number") totalMarks += block.content.marks;
    }
  }

  return {
    estimatedDuration: unknownDurationActivityCount === 0 ? knownDurationMinutes : null,
    knownDurationMinutes,
    unknownDurationActivityCount,
    hasUnknownDuration: unknownDurationActivityCount > 0,
    totalMarks,
    questionCount,
    activityCount: activities.length,
    practicalCount,
    resourceCount,
  };
}

export interface VersionNode {
  version: string;
  label: string;
  isVariant: boolean;
  parentVersion?: string;
}

export function buildVersionGraph(
  versions: { version: string; familyId?: string | null; difficulty?: string }[],
): VersionNode[] {
  return versions.map((v, i) => ({
    version: v.version,
    label: v.difficulty && v.difficulty !== "standard"
      ? `v${v.version} (${v.difficulty})`
      : `v${v.version}`,
    isVariant: v.familyId != null && v.difficulty != null && v.difficulty !== "standard",
    parentVersion: i > 0 ? versions[i - 1].version : undefined,
  }));
}

export const BUILT_IN_TEMPLATES: Record<string, CompositionTemplateSpec> = {
  "weekly-lesson": {
    weekTitle: "Teaching Week",
    description: "General teaching week structure",
    status: "published",
    sessions: [
      {
        title: "Lesson",
        kind: "session",
        activitySlots: [
          { type: "starter", label: "Starter Activity", estimatedDurationMinutes: 10 },
          { type: "main", label: "Main Teaching Activity", estimatedDurationMinutes: 35 },
          { type: "plenary", label: "Plenary / Reflection", estimatedDurationMinutes: 10 },
        ],
      },
    ],
  },
  "practical-lesson": {
    weekTitle: "Practical Week",
    sessions: [
      {
        title: "Practical Session",
        kind: "practical",
        activitySlots: [
          { type: "demo", label: "Demonstration", estimatedDurationMinutes: 15 },
          { type: "guided", label: "Guided Practice", estimatedDurationMinutes: 20 },
          { type: "independent", label: "Independent Practice", estimatedDurationMinutes: 30 },
          { type: "extension", label: "Extension Task", estimatedDurationMinutes: 15 },
        ],
      },
    ],
  },
  "revision-lesson": {
    weekTitle: "Revision Week",
    sessions: [
      {
        title: "Revision Session",
        kind: "revision",
        activitySlots: [
          { type: "retrieval", label: "Retrieval Quiz", estimatedDurationMinutes: 15 },
          { type: "review", label: "Topic Review", estimatedDurationMinutes: 20 },
          { type: "practice", label: "Practice Questions", estimatedDurationMinutes: 25 },
          { type: "reflection", label: "Reflection", estimatedDurationMinutes: 10 },
        ],
      },
    ],
  },
  "assessment-week": {
    weekTitle: "Assessment Week",
    sessions: [
      {
        title: "Assessment Preparation",
        kind: "revision",
        activitySlots: [
          { type: "review", label: "Key Concepts Review", estimatedDurationMinutes: 20 },
          { type: "practice", label: "Practice Assessment", estimatedDurationMinutes: 35 },
        ],
      },
      {
        title: "Formal Assessment",
        kind: "assessment",
        activitySlots: [
          { type: "assessment", label: "Assessment", estimatedDurationMinutes: 60 },
        ],
      },
    ],
  },
  "project-week": {
    weekTitle: "Project Week",
    sessions: [
      {
        title: "Project Session",
        kind: "project",
        activitySlots: [
          { type: "brief", label: "Project Brief", estimatedDurationMinutes: 10 },
          { type: "work", label: "Development Work", estimatedDurationMinutes: 50 },
          { type: "checkpoint", label: "Progress Checkpoint", estimatedDurationMinutes: 15 },
        ],
      },
    ],
  },
};

export function applyCompositionTemplate(
  draft: CompositionDraft,
  templateKey: string,
  weekNumber: number,
): CompositionDraft {
  const template = BUILT_IN_TEMPLATES[templateKey];
  if (!template) throw new Error(`Unknown composition template: ${templateKey}`);
  return applyTemplateSpec(draft, template, weekNumber);
}

export function applyCustomCompositionTemplate(
  draft: CompositionDraft,
  template: CompositionTemplateSpec,
  weekNumber: number,
): CompositionDraft {
  return applyTemplateSpec(draft, template, weekNumber);
}

function applyTemplateSpec(
  draft: CompositionDraft,
  template: CompositionTemplateSpec,
  weekNumber: number,
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const weekId = nextStableId(`week-${weekNumber}`, pkg.weeks.map((w) => w.id));

  const sessionIds: string[] = [];
  const usedActivityIds = new Set(pkg.activities.map((activity) => activity.id));
  for (const sessionSpec of template.sessions) {
    const sessionId = nextStableId(`${weekId}-session`, [...pkg.sessions.map((s) => s.id), ...sessionIds]);
    sessionIds.push(sessionId);

    const activityIds: string[] = [];
    for (const slot of sessionSpec.activitySlots) {
      const actId = nextStableId(`${sessionId}-${slot.type}`, [...usedActivityIds]);
      usedActivityIds.add(actId);
      activityIds.push(actId);
      const activity = createActivity({
        id: actId,
        title: slot.label,
        status: "planned",
        difficulty: slot.difficulty ?? "standard",
        estimatedDurationMinutes: normaliseDuration(slot.estimatedDurationMinutes),
        activityType: slot.type,
        learningIntent: slot.learningIntent ?? template.learningIntent ?? null,
        learningOutcomes: slot.learningOutcome ? [slot.learningOutcome] : [],
      });
      pkg.activities.push(activity);
    }

    const session = createSession({
      id: sessionId,
      title: sessionSpec.title,
      kind: sessionSpec.kind,
      weekId,
      activities: activityIds,
      summary: template.description ?? undefined,
    });
    pkg.sessions.push(session);
  }

  const week = createWeek({
    id: weekId,
    teachingWeek: weekNumber,
    title: `${template.weekTitle} ${weekNumber}`,
    sessions: sessionIds,
  });
  pkg.weeks.push(week);

  return { package: pkg, references: draft.references };
}

export const BUILT_IN_RECIPES: Record<string, RecipeSpec> = {
  "revision-session": {
    title: "Revision Session",
    kind: "revision",
    slots: [
      { type: "starter", label: "Starter", estimatedDurationMinutes: 10 },
      { type: "retrieval", label: "Retrieval Quiz", estimatedDurationMinutes: 15 },
      { type: "practice", label: "Practice Activity", estimatedDurationMinutes: 25 },
      { type: "reflection", label: "Reflection", estimatedDurationMinutes: 10 },
    ],
  },
  "retrieval-session": {
    title: "Retrieval Session",
    kind: "retrieval",
    slots: [
      { type: "retrieval", label: "Retrieval Quiz", estimatedDurationMinutes: 15 },
      { type: "review", label: "Review Answers", estimatedDurationMinutes: 10 },
      { type: "extension", label: "Extension Activity", estimatedDurationMinutes: 15 },
    ],
  },
  "practical-session": {
    title: "Practical Session",
    kind: "practical",
    slots: [
      { type: "demo", label: "Teacher Demonstration", estimatedDurationMinutes: 15 },
      { type: "guided", label: "Guided Practice", estimatedDurationMinutes: 20 },
      { type: "independent", label: "Independent Practice", estimatedDurationMinutes: 30 },
      { type: "stretch", label: "Stretch and Challenge", estimatedDurationMinutes: 15 },
    ],
  },
  "assessment-session": {
    title: "Assessment Session",
    kind: "assessment",
    slots: [
      { type: "instructions", label: "Assessment Instructions", estimatedDurationMinutes: 10 },
      { type: "assessment", label: "Formal Assessment", estimatedDurationMinutes: 50 },
      { type: "reflection", label: "Post-Assessment Reflection", estimatedDurationMinutes: 10 },
    ],
  },
  "homework-session": {
    title: "Homework Session",
    kind: "homework",
    slots: [
      { type: "consolidation", label: "Consolidation Activity", estimatedDurationMinutes: 20 },
      { type: "extension", label: "Extension Research", estimatedDurationMinutes: 15 },
    ],
  },
};

export function applyRecipe(
  draft: CompositionDraft,
  weekId: string,
  recipeKey: string,
): CompositionDraft {
  const recipe = BUILT_IN_RECIPES[recipeKey];
  if (!recipe) throw new Error(`Unknown recipe: ${recipeKey}`);
  return applyRecipeSpec(draft, weekId, recipe);
}

export function applyCustomRecipe(
  draft: CompositionDraft,
  weekId: string,
  recipe: RecipeSpec,
): CompositionDraft {
  return applyRecipeSpec(draft, weekId, recipe);
}

function applyRecipeSpec(
  draft: CompositionDraft,
  weekId: string,
  recipe: RecipeSpec,
): CompositionDraft {
  const pkg = clonePackage(draft.package);
  const sessionId = nextStableId(`${weekId}-${slugify(recipe.title, "session")}`, pkg.sessions.map((s) => s.id));

  const activityIds: string[] = [];
  const usedActivityIds = new Set(pkg.activities.map((activity) => activity.id));
  for (const slot of recipe.slots) {
    const actId = nextStableId(`${sessionId}-${slot.type}`, [...usedActivityIds]);
    usedActivityIds.add(actId);
    activityIds.push(actId);
    pkg.activities.push(createActivity({
      id: actId,
      title: slot.label,
      status: "planned",
      difficulty: slot.difficulty ?? "standard",
      estimatedDurationMinutes: normaliseDuration(slot.estimatedDurationMinutes),
      activityType: slot.type,
      learningIntent: slot.learningIntent ?? null,
      learningOutcomes: slot.learningOutcome ? [slot.learningOutcome] : [],
    }));
  }

  const session = createSession({
    id: sessionId,
    title: recipe.title,
    kind: recipe.kind,
    weekId,
    activities: activityIds,
    summary: recipe.description ?? "",
  });
  pkg.sessions.push(session);

  const weekIdx = pkg.weeks.findIndex((w) => w.id === weekId);
  if (weekIdx >= 0) {
    const week = { ...pkg.weeks[weekIdx] };
    const sessions = Array.isArray(week.relationships.sessions)
      ? [...(week.relationships.sessions as string[])]
      : [];
    sessions.push(sessionId);
    week.relationships = { ...week.relationships, sessions };
    pkg.weeks[weekIdx] = week;
  }

  return { package: pkg, references: draft.references };
}

export function emptyCompositionDraft(pkg: ContentPackage): CompositionDraft {
  return { package: pkg, references: [] };
}

export function rehydrateCompositionDraft(
  pkg: ContentPackage,
  references: CompositionReference[],
): CompositionDraft {
  const nextPackage = clonePackage(pkg);
  const refMap = new Map(references.map((reference) => [reference.instanceId, reference]));
  nextPackage.activities = nextPackage.activities.map((activity) => {
    const ref = refMap.get(activity.id);
    if (!ref || ref.libraryType !== "activity") return activity;
    return {
      ...activity,
      metadata: {
        ...activity.metadata,
        _compositionRef: {
          libraryId: ref.libraryItemId,
          libraryVersion: ref.libraryVersion,
          state: ref.state,
        },
      },
    };
  });
  return { package: nextPackage, references };
}

function questionToBlock(question: LibraryQuestion, activityId: string): ContentBlock {
  const typeMap: Record<string, string> = {
    single: "single-choice",
    multiple: "single-choice",
    text: "short-response",
    matching: "matching",
    classification: "classification",
    "short-response": "short-response",
    reflection: "reflection",
    "predict-output": "single-choice",
    "code-gap": "code-editor",
    "code-editor": "code-editor",
    "code-order": "matching",
    "line-select": "single-choice",
  };
  return {
    schema: "lp.content.block",
    schemaVersion: "0.1.0",
    id: `${activityId}:${question.stableKey}`,
    version: "1.0.0",
    type: typeMap[question.questionType] ?? "short-response",
    metadata: {},
    relationships: {},
    content: {
      questionId: `${activityId}:${question.stableKey}`,
      sourceQuestionId: question.stableKey,
      sourceType: question.questionType,
      prompt: question.questionText,
      formative: true,
      ...(question.content || {}),
    },
  };
}

export function resolveActivityEstimatedDuration(
  activity: ContentActivity,
  reference?: CompositionReference,
): number | null {
  const overrideValue = reference?.overrides.estimatedDurationMinutes;
  if (isValidDuration(overrideValue)) return Number(overrideValue);
  const metadataValue = activity.metadata.estimatedDurationMinutes;
  if (isValidDuration(metadataValue)) return Number(metadataValue);
  return null;
}

export function durationOverrideState(
  activity: ContentActivity,
  reference?: CompositionReference,
): { inherited: number | null; resolved: number | null; overridden: boolean } {
  const inherited = isValidDuration(activity.metadata.estimatedDurationMinutes)
    ? Number(activity.metadata.estimatedDurationMinutes)
    : null;
  const resolved = resolveActivityEstimatedDuration(activity, reference);
  const overridden = reference != null && Object.prototype.hasOwnProperty.call(reference.overrides, "estimatedDurationMinutes");
  return { inherited, resolved, overridden };
}

export function validateEstimatedDurationMinutes(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (!isValidDuration(value)) return "Duration must be a whole number between 1 and 480 minutes.";
  return null;
}

export function parseCustomTemplateRecord(row: Record<string, unknown>): CustomTemplateRecord {
  return {
    id: String(row.id ?? ""),
    stableKey: String(row.stable_key ?? ""),
    title: String(row.title ?? ""),
    templateType: String(row.template_type ?? "custom"),
    description: row.description == null ? null : String(row.description),
    specification: (row.specification as CompositionTemplateSpec | undefined) ?? { weekTitle: "Template", sessions: [] },
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    status: String(row.status ?? "draft"),
    version: String(row.version ?? "1.0.0"),
    author: String(row.author ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function parseCustomRecipeRecord(row: Record<string, unknown>): CustomRecipeRecord {
  return {
    id: String(row.id ?? ""),
    stableKey: String(row.stable_key ?? ""),
    title: String(row.title ?? ""),
    recipeType: String(row.recipe_type ?? "custom"),
    description: row.description == null ? null : String(row.description),
    specification: (row.specification as RecipeSpec | undefined) ?? { title: "Recipe", kind: "session", slots: [] },
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    status: String(row.status ?? "draft"),
    version: String(row.version ?? "1.0.0"),
    author: String(row.author ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normaliseDuration(value: unknown): number | null {
  return isValidDuration(value) ? Number(value) : null;
}

function isValidDuration(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value > 0
    && value <= 480;
}
