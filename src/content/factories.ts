import { getContentEngine } from "./engine.ts";
import type { ContentActivity, ContentBlock, ContentDocument, ContentPackage } from "./types";

function envelope(
  schema: string,
  id: string,
  metadata: Record<string, unknown>,
  relationships: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): ContentDocument {
  const engine = getContentEngine();
  return {
    schema,
    schemaVersion: engine.SCHEMA_VERSION,
    id,
    version: engine.SCHEMA_VERSION,
    metadata,
    relationships,
    ...extra,
  };
}

export function slugify(value: string, fallback: string) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function createHub(id: string, name: string, curriculumId: string): ContentDocument {
  const engine = getContentEngine();
  return envelope(engine.SCHEMAS.HUB, id, { name }, { curriculum: curriculumId });
}

export function createCurriculum(id: string, title: string, course: string): ContentDocument {
  const engine = getContentEngine();
  return envelope(
    engine.SCHEMAS.CURRICULUM,
    id,
    { title, course },
    { learningOutcomes: [], assignments: [], weeks: [] },
  );
}

export function createLearningOutcome(id: string, title: string): ContentDocument {
  const engine = getContentEngine();
  return envelope(engine.SCHEMAS.LEARNING_OUTCOME, id, { title }, {});
}

export function createAssignment(id: string, title: string): ContentDocument {
  const engine = getContentEngine();
  return envelope(
    engine.SCHEMAS.ASSIGNMENT,
    id,
    { title, status: "planned", key: id.toLowerCase(), criteria: [] },
    { learningOutcomes: [], weeks: [] },
  );
}

export function createWeek(input: {
  id: string;
  teachingWeek: number;
  title: string;
  status?: string;
  phase?: string;
  learningOutcomes?: string[];
  assignment?: string | null;
  sessions?: string[];
  weekCommencing?: string | null;
}): ContentDocument {
  const engine = getContentEngine();
  return envelope(
    engine.SCHEMAS.WEEK,
    input.id,
    {
      teachingWeek: input.teachingWeek,
      title: input.title,
      status: input.status || "planned",
      phase: input.phase || "teaching",
      weekCommencing: input.weekCommencing ?? null,
      releaseDate: null,
      dueDate: null,
      route: `weeks/${input.id}/`,
    },
    {
      learningOutcomes: input.learningOutcomes || [],
      assignment: input.assignment ?? null,
      sessions: input.sessions || [],
    },
  );
}

export function createSession(input: {
  id: string;
  title: string;
  kind: string;
  weekId?: string;
  activities?: string[];
  summary?: string;
  sortOrder?: number;
  defaultOpen?: boolean;
}): ContentDocument {
  const engine = getContentEngine();
  return envelope(
    engine.SCHEMAS.SESSION,
    input.id,
    {
      title: input.title,
      kind: input.kind,
      summary: input.summary || "",
      sortOrder: input.sortOrder ?? 0,
      defaultOpen: input.defaultOpen === true,
    },
    {
      week: input.weekId || "",
      activities: input.activities || [],
    },
  );
}

function defaultBlockContent(type: string): Record<string, unknown> {
  if (type === "heading") return { text: "Heading", level: 3 };
  if (type === "paragraph" || type === "markdown") return { text: "" };
  if (type === "callout") return { title: "Note", text: "", tone: "info" };
  if (type === "accordion") return { title: "More", body: "" };
  if (type === "hint") return { text: "" };
  if (type === "quote") return { text: "" };
  if (type === "reference") return { label: "", href: "" };
  if (type === "image" || type === "video") return { src: "", alt: "", title: "" };
  if (type === "teacher-note") return { text: "" };
  if (type === "divider") return {};
  if (type === "single-choice") {
    return {
      formative: true,
      prompt: "",
      options: [
        { id: "a", label: "Option A" },
        { id: "b", label: "Option B" },
      ],
      correctOptionId: "a",
      feedback: { correct: "", incorrect: "" },
    };
  }
  if (type === "classification") {
    return {
      formative: true,
      prompt: "Classify each item.",
      categories: [
        { id: "cat-a", label: "Category A" },
        { id: "cat-b", label: "Category B" },
      ],
      items: [{ id: "item-1", label: "Item 1", correctCategoryId: "cat-a" }],
    };
  }
  if (type === "short-response" || type === "reflection") {
    return { prompt: "", placeholder: "" };
  }
  if (type === "code-editor" || type === "python-exercise") {
    return {
      language: "python",
      label: "Python editor",
      starter: "",
      instructions: "",
      hints: [],
    };
  }
  return { text: "" };
}

export function nextStableId(prefix: string, existing: readonly string[]) {
  const used = new Set(existing);
  let index = existing.length + 1;
  let candidate = `${prefix}-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }
  return candidate;
}

export function createBlock(activityId: string, type: string, existingIds: readonly string[]): ContentBlock {
  const engine = getContentEngine();
  const canonical = engine.normaliseBlockType(type);
  if (!engine.isRegisteredBlockType(canonical) || !engine.getBlockType(canonical)?.implemented) {
    throw new Error(`Unsupported block type '${type}'`);
  }
  const id = nextStableId(`${activityId}-block`, existingIds);
  const content = defaultBlockContent(canonical);
  if (engine.isInteractiveBlockType(canonical)) {
    content.questionId = `${id}-q`;
  }
  return engine.normaliseBlock({
    id,
    type: canonical,
    content,
  });
}

export function duplicateBlock(block: ContentBlock, activityId: string, existingIds: readonly string[]): ContentBlock {
  const engine = getContentEngine();
  const id = nextStableId(`${activityId}-block`, existingIds);
  const content = { ...(block.content || {}) };
  if (typeof content.questionId === "string") {
    content.questionId = `${id}-q`;
  }
  return engine.normaliseBlock({
    ...block,
    id,
    content,
  });
}

export function createActivity(input: {
  id: string;
  title: string;
  status?: string;
  summary?: string;
  learningOutcomes?: string[];
  assignment?: string;
  difficulty?: "foundation" | "standard" | "challenge";
  familyId?: string;
}): ContentActivity {
  const engine = getContentEngine();
  return envelope(
    engine.SCHEMAS.ACTIVITY,
    input.id,
    {
      title: input.title,
      status: input.status || "planned",
      summary: input.summary || "",
      href: null,
      difficulty: input.difficulty || "standard",
      familyId: input.familyId || input.id,
    },
    {
      learningOutcomes: input.learningOutcomes || [],
      assignment: input.assignment || undefined,
      questions: [],
      assets: [],
      prerequisites: [],
    },
    { blocks: [] },
  ) as ContentActivity;
}

export function emptyPackage(hubId: string, hubName: string, courseKey: string): ContentPackage {
  const curriculumId = `${hubId}-curriculum`;
  const hub = createHub(hubId, hubName, curriculumId);
  const curriculum = createCurriculum(curriculumId, `${hubName} curriculum`, courseKey);
  return {
    hub,
    curriculum,
    learningOutcomes: [],
    assignments: [],
    weeks: [],
    sessions: [],
    activities: [],
    questions: [],
    assets: [],
  };
}

export function upsertOutcome(pkg: ContentPackage, id: string) {
  if (!id || pkg.learningOutcomes.some((item) => item.id === id)) return pkg;
  const next = { ...pkg, learningOutcomes: [...pkg.learningOutcomes, createLearningOutcome(id, id)] };
  const rel = next.curriculum.relationships;
  const ids = Array.isArray(rel.learningOutcomes) ? [...rel.learningOutcomes] : [];
  if (!ids.includes(id)) ids.push(id);
  next.curriculum = { ...next.curriculum, relationships: { ...rel, learningOutcomes: ids } };
  return next;
}

export function upsertAssignment(pkg: ContentPackage, id: string) {
  if (!id || pkg.assignments.some((item) => item.id === id)) return pkg;
  const next = { ...pkg, assignments: [...pkg.assignments, createAssignment(id, id)] };
  const rel = next.curriculum.relationships;
  const ids = Array.isArray(rel.assignments) ? [...rel.assignments] : [];
  if (!ids.includes(id)) ids.push(id);
  next.curriculum = { ...next.curriculum, relationships: { ...rel, assignments: ids } };
  return next;
}

export function syncCurriculumLists(pkg: ContentPackage): ContentPackage {
  return {
    ...pkg,
    curriculum: {
      ...pkg.curriculum,
      relationships: {
        ...pkg.curriculum.relationships,
        learningOutcomes: pkg.learningOutcomes.map((item) => item.id),
        assignments: pkg.assignments.map((item) => item.id),
        weeks: pkg.weeks.map((item) => item.id),
      },
    },
  };
}
