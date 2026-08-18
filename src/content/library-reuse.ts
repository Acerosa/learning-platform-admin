import { clonePackage } from "./clone.ts";
import { nextStableId } from "./factories.ts";
import type { ContentActivity, ContentBlock, ContentPackage } from "./types.ts";

export interface LibraryQuestion {
  id: string;
  stableKey: string;
  title: string;
  questionText: string;
  questionType: string;
  difficulty: number;
  marks: number;
  content: Record<string, unknown>;
  tags: string[];
  learningOutcomes: string[];
}

export interface LibraryActivity {
  id: string;
  stableKey: string;
  title: string;
  activityType: string;
  difficulty: string;
  familyId: string | null;
  summary: string | null;
  content: Record<string, unknown>;
  tags: string[];
  learningOutcomes: string[];
  questions: LibraryQuestion[];
}

export interface LibraryResource {
  id: string;
  stableKey: string;
  title: string;
  resourceType: string;
  url: string | null;
  description: string | null;
}

function questionToBlock(question: LibraryQuestion, activityId: string): ContentBlock {
  const blockType = mapQuestionTypeToBlockType(question.questionType);
  return {
    schema: "lp.content.block",
    schemaVersion: "0.1.0",
    id: `${activityId}:${question.stableKey}`,
    version: "1.0.0",
    type: blockType,
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

function mapQuestionTypeToBlockType(questionType: string): string {
  const map: Record<string, string> = {
    single: "single-choice",
    multiple: "single-choice",
    text: "short-response",
    matching: "matching",
    order: "matching",
    classification: "classification",
    "short-response": "short-response",
    reflection: "reflection",
    "predict-output": "single-choice",
    "code-gap": "code-editor",
    "code-editor": "code-editor",
    "code-order": "matching",
    "line-select": "single-choice",
  };
  return map[questionType] ?? "short-response";
}

export function addQuestionFromLibrary(
  pkg: ContentPackage,
  activityId: string,
  question: LibraryQuestion,
): ContentPackage {
  const next = clonePackage(pkg);
  const activityIndex = next.activities.findIndex((a) => a.id === activityId);
  if (activityIndex < 0) throw new Error(`Activity ${activityId} not found in package.`);

  const activity = { ...next.activities[activityIndex] };
  const block = questionToBlock(question, activityId);
  activity.blocks = [...activity.blocks, block];
  next.activities[activityIndex] = activity;
  return next;
}

export function duplicateActivityFromLibrary(
  pkg: ContentPackage,
  libraryActivity: LibraryActivity,
): ContentPackage {
  const existingIds = pkg.activities.map((a) => a.id);
  const id = nextStableId(libraryActivity.stableKey, existingIds);

  const blocks: ContentBlock[] = libraryActivity.questions.map((q) =>
    questionToBlock(q, id),
  );

  const activity: ContentActivity = {
    schema: "lp.content.activity",
    schemaVersion: "0.1.0",
    id,
    version: "0.1.0",
    metadata: {
      title: libraryActivity.title,
      status: "available",
      activityType: libraryActivity.activityType,
      difficulty: libraryActivity.difficulty,
      familyId: libraryActivity.familyId,
      summary: libraryActivity.summary,
    },
    relationships: {
      learningOutcomes: libraryActivity.learningOutcomes,
      assignment: "formative-practice",
      questions: [],
      assets: [],
    },
    blocks,
  };

  const next = clonePackage(pkg);
  next.activities = [...next.activities, activity];
  return next;
}

export function attachResourceFromLibrary(
  pkg: ContentPackage,
  activityId: string,
  resource: LibraryResource,
): ContentPackage {
  const next = clonePackage(pkg);
  const activityIndex = next.activities.findIndex((a) => a.id === activityId);
  if (activityIndex < 0) throw new Error(`Activity ${activityId} not found in package.`);

  const activity = { ...next.activities[activityIndex] };
  const block: ContentBlock = {
    schema: "lp.content.block",
    schemaVersion: "0.1.0",
    id: `${activityId}:resource-${resource.stableKey}`,
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
  next.activities[activityIndex] = activity;
  return next;
}
