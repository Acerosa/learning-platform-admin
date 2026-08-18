import { clonePackage } from "./clone.ts";
import { nextStableId } from "./factories.ts";
import type { ContentActivity, ContentBlock, ContentPackage } from "./types.ts";
import type { LibraryQuestion } from "./library-reuse.ts";

export interface RetrievalQuizCriteria {
  questionCount: number;
  weekNumbers?: number[];
  difficulty?: { min?: number; max?: number };
  topics?: string[];
  tags?: string[];
  excludeQuestionIds?: string[];
}

export interface AssessmentCriteria {
  title: string;
  totalMarks: number;
  durationMinutes: number;
  learningOutcomes?: string[];
  difficulty?: { min?: number; max?: number };
  topics?: string[];
  tags?: string[];
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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
      formative: false,
      ...(question.content || {}),
    },
  };
}

function filterQuestions(
  questions: LibraryQuestion[],
  criteria: { difficulty?: { min?: number; max?: number }; topics?: string[]; tags?: string[]; excludeQuestionIds?: string[] },
): LibraryQuestion[] {
  return questions.filter((q) => {
    if (criteria.excludeQuestionIds?.includes(q.stableKey)) return false;
    if (criteria.difficulty) {
      if (criteria.difficulty.min != null && q.difficulty < criteria.difficulty.min) return false;
      if (criteria.difficulty.max != null && q.difficulty > criteria.difficulty.max) return false;
    }
    if (criteria.topics?.length && !criteria.topics.some((t) => q.tags.includes(t) || q.learningOutcomes.includes(t))) return false;
    if (criteria.tags?.length && !criteria.tags.some((t) => q.tags.includes(t))) return false;
    return true;
  });
}

export function buildRetrievalQuiz(
  pkg: ContentPackage,
  availableQuestions: LibraryQuestion[],
  criteria: RetrievalQuizCriteria,
  seed?: number,
): ContentPackage {
  const filtered = filterQuestions(availableQuestions, criteria);

  const effectiveSeed = seed ?? Date.now();
  const shuffled = seededShuffle(filtered, effectiveSeed);
  const selected = shuffled.slice(0, criteria.questionCount);

  if (selected.length === 0) {
    throw new Error("No questions match the retrieval quiz criteria.");
  }

  const existingIds = pkg.activities.map((a) => a.id);
  const activityId = nextStableId("retrieval-quiz", existingIds);

  const blocks: ContentBlock[] = [
    {
      schema: "lp.content.block",
      schemaVersion: "0.1.0",
      id: `${activityId}:heading`,
      version: "1.0.0",
      type: "heading",
      metadata: {},
      relationships: {},
      content: { text: "Retrieval Quiz", level: 2 },
    },
    ...selected.map((q) => questionToBlock(q, activityId)),
  ];

  const activity: ContentActivity = {
    schema: "lp.content.activity",
    schemaVersion: "0.1.0",
    id: activityId,
    version: "0.1.0",
    metadata: {
      title: `Retrieval Quiz (${selected.length} questions)`,
      status: "available",
      activityType: "Retrieval Quiz",
    },
    relationships: {
      learningOutcomes: [...new Set(selected.flatMap((q) => q.learningOutcomes))],
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

export function buildAssessment(
  pkg: ContentPackage,
  availableQuestions: LibraryQuestion[],
  criteria: AssessmentCriteria,
): ContentPackage {
  const filtered = filterQuestions(availableQuestions, {
    difficulty: criteria.difficulty,
    topics: criteria.topics,
    tags: criteria.tags,
  });

  if (criteria.learningOutcomes?.length) {
    const loSet = new Set(criteria.learningOutcomes);
    const loFiltered = filtered.filter((q) =>
      q.learningOutcomes.some((lo) => loSet.has(lo)),
    );
    if (loFiltered.length > 0) {
      filtered.length = 0;
      filtered.push(...loFiltered);
    }
  }

  const selected: LibraryQuestion[] = [];
  let currentMarks = 0;

  const sorted = [...filtered].sort((a, b) => b.marks - a.marks);
  for (const q of sorted) {
    if (currentMarks + q.marks <= criteria.totalMarks) {
      selected.push(q);
      currentMarks += q.marks;
    }
    if (currentMarks >= criteria.totalMarks) break;
  }

  if (selected.length === 0) {
    throw new Error("No questions match the assessment criteria.");
  }

  const existingIds = pkg.activities.map((a) => a.id);
  const activityId = nextStableId("assessment", existingIds);

  const blocks: ContentBlock[] = [
    {
      schema: "lp.content.block",
      schemaVersion: "0.1.0",
      id: `${activityId}:heading`,
      version: "1.0.0",
      type: "heading",
      metadata: {},
      relationships: {},
      content: { text: criteria.title, level: 2 },
    },
    {
      schema: "lp.content.block",
      schemaVersion: "0.1.0",
      id: `${activityId}:info`,
      version: "1.0.0",
      type: "callout",
      metadata: {},
      relationships: {},
      content: {
        text: `Total marks: ${currentMarks}/${criteria.totalMarks} · Duration: ${criteria.durationMinutes} minutes · Questions: ${selected.length}`,
        tone: "info",
      },
    },
    ...selected.map((q) => questionToBlock(q, activityId)),
  ];

  const activity: ContentActivity = {
    schema: "lp.content.activity",
    schemaVersion: "0.1.0",
    id: activityId,
    version: "0.1.0",
    metadata: {
      title: criteria.title,
      status: "available",
      activityType: "Assessment",
      totalMarks: currentMarks,
      durationMinutes: criteria.durationMinutes,
    },
    relationships: {
      learningOutcomes: [...new Set(selected.flatMap((q) => q.learningOutcomes))],
      assignment: "summative-assessment",
      questions: [],
      assets: [],
    },
    blocks,
  };

  const next = clonePackage(pkg);
  next.activities = [...next.activities, activity];
  return next;
}
