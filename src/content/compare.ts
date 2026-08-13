import type { ContentActivity, ContentBlock, ContentDocument, ContentPackage } from "./types";

export type DiffKind = "added" | "removed" | "changed";

export interface FieldChange {
  path: string;
  kind: DiffKind;
  before?: string;
  after?: string;
}

export interface EntityDiff {
  id: string;
  label: string;
  kind: DiffKind | "unchanged";
  changes: FieldChange[];
}

export interface StructuredDiff {
  metadata: FieldChange[];
  weeks: EntityDiff[];
  sessions: EntityDiff[];
  activities: EntityDiff[];
  blocks: EntityDiff[];
}

function display(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ") || "—";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function equal(left: unknown, right: unknown) {
  return display(left) === display(right);
}

function diffFields(prefix: string, before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined, keys: readonly string[]): FieldChange[] {
  const changes: FieldChange[] = [];
  keys.forEach((key) => {
    const left = before?.[key];
    const right = after?.[key];
    if (equal(left, right)) return;
    if (left == null && right != null) {
      changes.push({ path: `${prefix}.${key}`, kind: "added", after: display(right) });
    } else if (left != null && right == null) {
      changes.push({ path: `${prefix}.${key}`, kind: "removed", before: display(left) });
    } else {
      changes.push({ path: `${prefix}.${key}`, kind: "changed", before: display(left), after: display(right) });
    }
  });
  return changes;
}

function compareById<T extends { id: string }>(
  before: readonly T[],
  after: readonly T[],
  labelOf: (item: T) => string,
  compare: (left: T, right: T) => FieldChange[],
): EntityDiff[] {
  const previous = new Map(before.map((item) => [item.id, item]));
  const next = new Map(after.map((item) => [item.id, item]));
  const ids = [...new Set([...previous.keys(), ...next.keys()])];
  return ids.map((id) => {
    const left = previous.get(id);
    const right = next.get(id);
    if (left && !right) {
      return { id, label: labelOf(left), kind: "removed", changes: [{ path: id, kind: "removed", before: labelOf(left) }] };
    }
    if (!left && right) {
      return { id, label: labelOf(right), kind: "added", changes: [{ path: id, kind: "added", after: labelOf(right) }] };
    }
    const changes = compare(left as T, right as T);
    return {
      id,
      label: labelOf(right as T),
      kind: changes.length ? "changed" : "unchanged",
      changes,
    };
  });
}

function documentLabel(doc: ContentDocument) {
  return String(doc.metadata.title || doc.id);
}

function compareWeek(left: ContentDocument, right: ContentDocument): FieldChange[] {
  return [
    ...diffFields("metadata", left.metadata, right.metadata, [
      "title", "teachingWeek", "status", "phase", "weekCommencing", "releaseDate", "dueDate", "route",
    ]),
    ...diffFields("relationships", left.relationships, right.relationships, [
      "learningOutcomes", "assignment", "sessions",
    ]),
  ];
}

function compareSession(left: ContentDocument, right: ContentDocument): FieldChange[] {
  return [
    ...diffFields("metadata", left.metadata, right.metadata, [
      "title", "kind", "summary", "sortOrder", "defaultOpen",
    ]),
    ...diffFields("relationships", left.relationships, right.relationships, ["week", "activities"]),
  ];
}

function compareActivity(left: ContentActivity, right: ContentActivity): FieldChange[] {
  return [
    ...diffFields("metadata", left.metadata, right.metadata, ["title", "status", "summary", "href"]),
    ...diffFields("relationships", left.relationships, right.relationships, [
      "learningOutcomes", "assignment", "questions", "assets", "prerequisites",
    ]),
  ];
}

function blockContentKeys(block: ContentBlock) {
  return Object.keys(block.content || {}).sort();
}

function compareBlock(left: ContentBlock, right: ContentBlock): FieldChange[] {
  const keys = [...new Set([...blockContentKeys(left), ...blockContentKeys(right)])];
  return [
    ...diffFields("", { type: left.type }, { type: right.type }, ["type"]),
    ...diffFields("content", left.content, right.content, keys),
  ].map((change) => ({
    ...change,
    path: change.path.replace(/^\./, ""),
  }));
}

function flattenBlocks(pkg: ContentPackage) {
  return pkg.activities.flatMap((activity) => (
    (activity.blocks || []).map((block) => ({
      ...block,
      id: `${activity.id}/${block.id}`,
      activityId: activity.id,
    }))
  ));
}

export function comparePackages(before: ContentPackage, after: ContentPackage): StructuredDiff {
  const metadata = [
    ...diffFields("hub.metadata", before.hub.metadata, after.hub.metadata, Object.keys({ ...before.hub.metadata, ...after.hub.metadata })),
    ...diffFields("curriculum.metadata", before.curriculum.metadata, after.curriculum.metadata, Object.keys({ ...before.curriculum.metadata, ...after.curriculum.metadata })),
  ];
  const weeks = compareById(before.weeks, after.weeks, documentLabel, compareWeek);
  const sessions = compareById(before.sessions, after.sessions, documentLabel, compareSession);
  const activities = compareById(before.activities, after.activities, documentLabel, compareActivity);
  const blocks = compareById(
    flattenBlocks(before),
    flattenBlocks(after),
    (block) => `${block.activityId} · ${block.id.split("/")[1]} · ${block.type}`,
    compareBlock,
  );
  return { metadata, weeks, sessions, activities, blocks };
}

export function hasStructuredChanges(diff: StructuredDiff) {
  return (
    diff.metadata.length > 0
    || diff.weeks.some((item) => item.kind !== "unchanged")
    || diff.sessions.some((item) => item.kind !== "unchanged")
    || diff.activities.some((item) => item.kind !== "unchanged")
    || diff.blocks.some((item) => item.kind !== "unchanged")
  );
}
