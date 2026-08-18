import assert from "node:assert/strict";
import test from "node:test";
import {
  compositionToDraft,
  comparePackages,
  materialise,
  previewPackageJson,
  updateDraftFromComposition,
} from "../src/content/materialise.ts";
import {
  type CompositionDraft,
  applyCompositionTemplate,
  applyOverride,
  detachFromLibrary,
  emptyCompositionDraft,
  insertActivityFromLibrary,
  attachResourceFromLibrary,
  rehydrateCompositionDraft,
  reorderActivities,
} from "../src/content/composition-engine.ts";
import {
  buildCompositionDraftFromPackage,
  parseCompositionReferences,
  serialiseCompositionReferences,
} from "../src/content/composition-persistence.ts";
import { createSession, createWeek, emptyPackage } from "../src/content/factories.ts";
import type { ContentActivity } from "../src/content/types.ts";

function makeDraft(): CompositionDraft {
  return emptyCompositionDraft(emptyPackage("test-hub", "Test Hub", "test-course"));
}

function makeActivity(id: string, title: string): ContentActivity {
  return {
    schema: "lp.content.activity",
    schemaVersion: "0.1.0",
    id,
    version: "1.0.0",
    metadata: { title, status: "available", difficulty: "standard" },
    relationships: { learningOutcomes: ["LO1"], assignment: "formative-practice", questions: [], assets: [] },
    blocks: [],
  };
}

// ─── Materialisation ─────────────────────────────────────────────────────────

test("materialise resolves inherited activity without _compositionRef", () => {
  let draft = makeDraft();
  draft.package.sessions.push(createSession({ id: "s1", title: "S1", kind: "lesson" }));
  draft = insertActivityFromLibrary(draft, "s1", {
    stableKey: "prog-diag",
    libraryId: "lib-1",
    title: "Programming Diagnostic",
    activityType: "Diagnostic",
    difficulty: "standard",
    familyId: null,
    summary: null,
    version: "1.0.0",
    learningOutcomes: ["LO1"],
    blocks: [],
  });

  const pkg = materialise(draft);
  assert.equal(pkg.activities.length, 1);
  assert.equal(pkg.activities[0].metadata._compositionRef, undefined);
  assert.equal(pkg.activities[0].metadata.title, "Programming Diagnostic");
});

test("materialise applies overrides to activity metadata", () => {
  let draft = makeDraft();
  draft.package.sessions.push(createSession({ id: "s1", title: "S1", kind: "lesson" }));
  draft = insertActivityFromLibrary(draft, "s1", {
    stableKey: "prog-diag",
    libraryId: "lib-1",
    title: "Original Title",
    activityType: "Diagnostic",
    difficulty: "standard",
    familyId: null,
    summary: null,
    version: "1.0.0",
    learningOutcomes: [],
    blocks: [],
  });

  const instanceId = draft.package.activities[0].id;
  draft = applyOverride(draft, instanceId, "title", "Overridden Title");

  const pkg = materialise(draft);
  assert.equal(pkg.activities[0].metadata.title, "Overridden Title");
  assert.equal(pkg.activities[0].metadata._compositionRef, undefined);
});

test("materialise resolves overridden duration into final package", () => {
  let draft = makeDraft();
  draft.package.sessions.push(createSession({ id: "s1", title: "S1", kind: "lesson" }));
  draft = insertActivityFromLibrary(draft, "s1", {
    stableKey: "prog-diag",
    libraryId: "lib-1",
    title: "Original Title",
    activityType: "Diagnostic",
    difficulty: "standard",
    familyId: null,
    summary: null,
    version: "1.0.0",
    learningOutcomes: [],
    blocks: [],
    estimatedDurationMinutes: 20,
  });

  const instanceId = draft.package.activities[0].id;
  draft = applyOverride(draft, instanceId, "estimatedDurationMinutes", 35);

  const pkg = materialise(draft);
  assert.equal(pkg.activities[0].metadata.estimatedDurationMinutes, 35);
});

test("materialise strips _compositionRef from detached activities", () => {
  let draft = makeDraft();
  draft.package.sessions.push(createSession({ id: "s1", title: "S1", kind: "lesson" }));
  draft = insertActivityFromLibrary(draft, "s1", {
    stableKey: "prog-diag",
    libraryId: "lib-1",
    title: "Title",
    activityType: "Diagnostic",
    difficulty: "standard",
    familyId: null,
    summary: null,
    version: "1.0.0",
    learningOutcomes: [],
    blocks: [],
  });

  const instanceId = draft.package.activities[0].id;
  draft = detachFromLibrary(draft, instanceId);

  const pkg = materialise(draft);
  assert.equal(pkg.activities[0].metadata._compositionRef, undefined);
});

test("materialise includes resources from library", () => {
  let draft = makeDraft();
  const act = makeActivity("act-1", "Test");
  draft.package.activities.push(act);

  draft = attachResourceFromLibrary(draft, "act-1", {
    id: "r-1",
    stableKey: "owasp",
    title: "OWASP",
    resourceType: "website",
    url: "https://owasp.org",
    description: "Security guide",
  });

  const pkg = materialise(draft);
  assert.equal(pkg.activities[0].blocks.length, 1);
  assert.equal(pkg.activities[0].blocks[0].type, "reference");
});

// ─── Draft Integration ───────────────────────────────────────────────────────

test("compositionToDraft creates a standard AuthoringDraft", () => {
  let draft = makeDraft();
  draft = applyCompositionTemplate(draft, "weekly-lesson", 1);

  const authoringDraft = compositionToDraft(draft, "test-hub", "Test Hub", "test-course", "author");

  assert.equal(authoringDraft.status, "draft");
  assert.equal(authoringDraft.hubId, "test-hub");
  assert.equal(authoringDraft.courseKey, "test-course");
  assert.ok(authoringDraft.package.weeks.length > 0);
  assert.ok(authoringDraft.package.activities.length > 0);
});

test("updateDraftFromComposition preserves draft identity", () => {
  let draft = makeDraft();
  draft = applyCompositionTemplate(draft, "weekly-lesson", 1);

  const firstDraft = compositionToDraft(draft, "test-hub", "Test Hub", "test-course", "author");
  const originalId = firstDraft.id;

  draft = applyCompositionTemplate(draft, "practical-lesson", 2);
  const updated = updateDraftFromComposition(firstDraft, draft);

  assert.equal(updated.id, originalId);
  assert.equal(updated.status, "draft");
  assert.ok(updated.package.weeks.length > firstDraft.package.weeks.length);
});

test("composition references can be serialised and rehydrated for reopen", () => {
  let draft = makeDraft();
  draft.package.sessions.push(createSession({ id: "s1", title: "S1", kind: "lesson" }));
  draft = insertActivityFromLibrary(draft, "s1", {
    stableKey: "prog-diag",
    libraryId: "lib-1",
    title: "Programming Diagnostic",
    activityType: "Diagnostic",
    difficulty: "standard",
    familyId: null,
    summary: null,
    version: "1.0.0",
    learningOutcomes: [],
    blocks: [],
    estimatedDurationMinutes: 20,
  });
  const instanceId = draft.package.activities[0].id;
  draft = applyOverride(draft, instanceId, "estimatedDurationMinutes", 30);

  const authoringDraft = compositionToDraft(draft, "test-hub", "Test Hub", "test-course", "author");
  const serialised = serialiseCompositionReferences(draft.references);
  const parsed = parseCompositionReferences(serialised as Record<string, unknown>[]);
  const reopened = rehydrateCompositionDraft(authoringDraft.package, parsed);

  assert.equal(reopened.references[0].instanceId, instanceId);
  assert.equal(reopened.references[0].overrides.estimatedDurationMinutes, 30);
  assert.deepEqual(
    reopened.package.activities[0].metadata._compositionRef,
    { libraryId: "lib-1", libraryVersion: "1.0.0", state: "overridden" },
  );
});

test("buildCompositionDraftFromPackage rehydrates materialised draft with refs", () => {
  const pkg = emptyPackage("h", "H", "c");
  const reopened = buildCompositionDraftFromPackage(pkg, [{
    instanceId: "activity-1",
    libraryType: "activity",
    libraryItemId: "lib-1",
    libraryVersion: "1.0.0",
    state: "inherited",
    overrides: {},
  }]);
  assert.equal(reopened.references.length, 1);
});

test("updateDraftFromComposition rejects non-draft records", () => {
  const draft = makeDraft();
  const authoringDraft = compositionToDraft(draft, "h", "H", "c", "a");
  const published = { ...authoringDraft, status: "published" as const };

  assert.throws(() => updateDraftFromComposition(published, draft), /non-draft/i);
});

// ─── Draft Comparison ────────────────────────────────────────────────────────

test("comparePackages detects added and removed activities", () => {
  const base = emptyPackage("h", "H", "c");
  base.activities.push(makeActivity("a1", "A1"), makeActivity("a2", "A2"));

  const current = emptyPackage("h", "H", "c");
  current.activities.push(makeActivity("a1", "A1"), makeActivity("a3", "A3"));

  const diff = comparePackages(current, base);
  assert.deepEqual(diff.addedActivities, ["a3"]);
  assert.deepEqual(diff.removedActivities, ["a2"]);
});

test("comparePackages detects changed activities", () => {
  const base = emptyPackage("h", "H", "c");
  base.activities.push(makeActivity("a1", "Original"));

  const current = emptyPackage("h", "H", "c");
  const changed = makeActivity("a1", "Changed");
  current.activities.push(changed);

  const diff = comparePackages(current, base);
  assert.ok(diff.changedActivities.includes("a1"));
});

// ─── Package Preview ─────────────────────────────────────────────────────────

test("previewPackageJson returns valid JSON", () => {
  const draft = makeDraft();
  const json = previewPackageJson(draft);
  const parsed = JSON.parse(json);
  assert.ok(parsed.hub);
  assert.ok(parsed.curriculum);
  assert.ok(Array.isArray(parsed.activities));
});

// ─── Publication Compatibility ────────────────────────────────────────────────

test("materialised package has correct schema versions", () => {
  let draft = makeDraft();
  draft = applyCompositionTemplate(draft, "weekly-lesson", 1);

  const pkg = materialise(draft);
  assert.equal(pkg.hub.schemaVersion, "0.1.0");
  assert.equal(pkg.curriculum.schemaVersion, "0.1.0");
  for (const activity of pkg.activities) {
    assert.equal(activity.schemaVersion, "0.1.0");
  }
});

// ─── Drag-and-drop (reorder) ─────────────────────────────────────────────────

test("reorderActivities preserves all activities", () => {
  let draft = makeDraft();
  const session = createSession({ id: "s1", title: "S1", kind: "lesson", activities: ["a1", "a2", "a3"] });
  draft.package.sessions.push(session);

  draft = reorderActivities(draft, "s1", ["a3", "a1", "a2"]);
  const result = draft.package.sessions[0].relationships.activities as string[];
  assert.deepEqual(result, ["a3", "a1", "a2"]);
  assert.equal(result.length, 3);
});
