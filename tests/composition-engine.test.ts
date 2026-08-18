import assert from "node:assert/strict";
import test from "node:test";
import {
  type CompositionDraft,
  acceptUpdate,
  analyseCoverage,
  analyseDifficultyBalance,
  applyCompositionTemplate,
  applyOverride,
  applyRecipe,
  clearOverride,
  compareActivities,
  computeSessionStats,
  detachFromLibrary,
  emptyCompositionDraft,
  findUpdatesAvailable,
  insertActivityFromLibrary,
  insertQuestionFromLibrary,
  reorderActivities,
  reorderQuestions,
  attachResourceFromLibrary,
  applyCustomCompositionTemplate,
  applyCustomRecipe,
  buildVersionGraph,
  BUILT_IN_TEMPLATES,
  BUILT_IN_RECIPES,
  durationOverrideState,
  parseCustomRecipeRecord,
  parseCustomTemplateRecord,
  reorderSessions,
  reorderWeeks,
  resolveActivityEstimatedDuration,
  validateEstimatedDurationMinutes,
} from "../src/content/composition-engine.ts";
import { createActivity, createSession, createWeek, emptyPackage } from "../src/content/factories.ts";
import type { ContentActivity, ContentBlock } from "../src/content/types.ts";

function makeDraft(): CompositionDraft {
  const pkg = emptyPackage("test-hub", "Test Hub", "test-course");
  return emptyCompositionDraft(pkg);
}

function makeActivity(id: string, title: string, difficulty = "standard"): ContentActivity {
  return {
    schema: "lp.content.activity",
    schemaVersion: "0.1.0",
    id,
    version: "1.0.0",
    metadata: { title, status: "available", difficulty },
    relationships: { learningOutcomes: ["LO1"], assignment: "formative-practice", questions: [], assets: [] },
    blocks: [],
  };
}

// ─── Insert Activity ─────────────────────────────────────────────────────────

test("insertActivityFromLibrary adds activity and creates reference", () => {
  let draft = makeDraft();
  const session = createSession({ id: "s1", title: "Session 1", kind: "lesson" });
  draft.package.sessions.push(session);

  draft = insertActivityFromLibrary(draft, "s1", {
    stableKey: "prog-diag",
    libraryId: "lib-001",
    title: "Programming Diagnostic",
    activityType: "Diagnostic",
    difficulty: "standard",
    familyId: null,
    summary: null,
    version: "1.2.0",
    learningOutcomes: ["LO1"],
    blocks: [],
  });

  assert.equal(draft.package.activities.length, 1);
  assert.equal(draft.references.length, 1);
  assert.equal(draft.references[0].libraryItemId, "lib-001");
  assert.equal(draft.references[0].state, "inherited");
  assert.equal(draft.references[0].libraryVersion, "1.2.0");

  const sessionActivities = draft.package.sessions[0].relationships.activities as string[];
  assert.equal(sessionActivities.length, 1);
});

// ─── Insert Question ─────────────────────────────────────────────────────────

test("insertQuestionFromLibrary adds block and reference", () => {
  let draft = makeDraft();
  const activity = makeActivity("act-1", "Test Activity");
  draft.package.activities.push(activity);

  draft = insertQuestionFromLibrary(draft, "act-1", {
    id: "q-001",
    stableKey: "cia-q1",
    title: "CIA Triad Q1",
    questionText: "What does CIA stand for?",
    questionType: "single",
    difficulty: 2,
    marks: 1,
    content: {},
    tags: ["week-1"],
    learningOutcomes: ["LO1"],
  });

  assert.equal(draft.package.activities[0].blocks.length, 1);
  assert.equal(draft.references.length, 1);
  assert.equal(draft.references[0].libraryType, "question");
});

// ─── Attach Resource ─────────────────────────────────────────────────────────

test("attachResourceFromLibrary adds reference block", () => {
  let draft = makeDraft();
  draft.package.activities.push(makeActivity("act-1", "Test"));

  draft = attachResourceFromLibrary(draft, "act-1", {
    id: "r-001",
    stableKey: "owasp-guide",
    title: "OWASP Guide",
    resourceType: "website",
    url: "https://owasp.org",
    description: "Security guide",
  });

  assert.equal(draft.package.activities[0].blocks.length, 1);
  assert.equal(draft.package.activities[0].blocks[0].type, "reference");
  assert.equal(draft.references.length, 1);
  assert.equal(draft.references[0].libraryType, "resource");
});

// ─── Reorder Activities ──────────────────────────────────────────────────────

test("reorderActivities changes session activity order", () => {
  let draft = makeDraft();
  const session = createSession({ id: "s1", title: "S1", kind: "lesson", activities: ["a1", "a2", "a3"] });
  draft.package.sessions.push(session);

  draft = reorderActivities(draft, "s1", ["a3", "a1", "a2"]);
  const order = draft.package.sessions[0].relationships.activities as string[];
  assert.deepEqual(order, ["a3", "a1", "a2"]);
});

test("reorderWeeks changes curriculum week order", () => {
  let draft = makeDraft();
  draft.package.weeks.push(
    createWeek({ id: "w1", teachingWeek: 1, title: "Week 1" }),
    createWeek({ id: "w2", teachingWeek: 2, title: "Week 2" }),
  );

  draft = reorderWeeks(draft, ["w2", "w1"]);
  assert.deepEqual(draft.package.weeks.map((week) => week.id), ["w2", "w1"]);
});

test("reorderSessions changes week session order", () => {
  let draft = makeDraft();
  draft.package.weeks.push(createWeek({ id: "w1", teachingWeek: 1, title: "Week 1", sessions: ["s1", "s2"] }));
  draft.package.sessions.push(
    createSession({ id: "s1", title: "Session 1", kind: "lesson", weekId: "w1" }),
    createSession({ id: "s2", title: "Session 2", kind: "lesson", weekId: "w1" }),
  );

  draft = reorderSessions(draft, "w1", ["s2", "s1"]);
  assert.deepEqual(draft.package.weeks[0].relationships.sessions, ["s2", "s1"]);
});

// ─── Reorder Questions ───────────────────────────────────────────────────────

test("reorderQuestions changes block order", () => {
  let draft = makeDraft();
  const activity = makeActivity("act-1", "Test");
  activity.blocks = [
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b1", version: "1.0.0", type: "single-choice", metadata: {}, relationships: {}, content: { questionId: "q1" } },
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b2", version: "1.0.0", type: "single-choice", metadata: {}, relationships: {}, content: { questionId: "q2" } },
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b3", version: "1.0.0", type: "single-choice", metadata: {}, relationships: {}, content: { questionId: "q3" } },
  ];
  draft.package.activities.push(activity);

  draft = reorderQuestions(draft, "act-1", ["b3", "b1", "b2"]);
  assert.deepEqual(draft.package.activities[0].blocks.map((b) => b.id), ["b3", "b1", "b2"]);
});

// ─── Override ─────────────────────────────────────────────────────────────────

test("applyOverride changes state to overridden", () => {
  let draft = makeDraft();
  draft.references = [{
    instanceId: "act-1",
    libraryType: "activity",
    libraryItemId: "lib-001",
    libraryVersion: "1.0.0",
    state: "inherited",
    overrides: {},
  }];

  draft = applyOverride(draft, "act-1", "title", "Custom Title");
  assert.equal(draft.references[0].state, "overridden");
  assert.equal(draft.references[0].overrides.title, "Custom Title");
});

test("clearOverride reverts to inherited when no overrides remain", () => {
  let draft = makeDraft();
  draft.references = [{
    instanceId: "act-1",
    libraryType: "activity",
    libraryItemId: "lib-001",
    libraryVersion: "1.0.0",
    state: "overridden",
    overrides: { title: "Custom" },
  }];

  draft = clearOverride(draft, "act-1", "title");
  assert.equal(draft.references[0].state, "inherited");
  assert.deepEqual(draft.references[0].overrides, {});
});

// ─── Detach ───────────────────────────────────────────────────────────────────

test("detachFromLibrary sets state to detached", () => {
  let draft = makeDraft();
  draft.references = [{
    instanceId: "act-1",
    libraryType: "activity",
    libraryItemId: "lib-001",
    libraryVersion: "1.0.0",
    state: "inherited",
    overrides: {},
  }];

  draft = detachFromLibrary(draft, "act-1");
  assert.equal(draft.references[0].state, "detached");
});

test("applyOverride does not modify detached references", () => {
  let draft = makeDraft();
  draft.references = [{
    instanceId: "act-1",
    libraryType: "activity",
    libraryItemId: "lib-001",
    libraryVersion: "1.0.0",
    state: "detached",
    overrides: {},
  }];

  draft = applyOverride(draft, "act-1", "title", "Should not change");
  assert.equal(draft.references[0].state, "detached");
  assert.deepEqual(draft.references[0].overrides, {});
});

// ─── Update from Library ─────────────────────────────────────────────────────

test("findUpdatesAvailable detects version mismatch", () => {
  const draft = makeDraft();
  draft.references = [{
    instanceId: "act-1",
    libraryType: "activity",
    libraryItemId: "lib-001",
    libraryVersion: "1.0.0",
    state: "inherited",
    overrides: {},
  }];

  const versions = new Map([["activity:lib-001", "1.3.0"]]);
  const updates = findUpdatesAvailable(draft, versions);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].currentVersion, "1.0.0");
  assert.equal(updates[0].latestVersion, "1.3.0");
});

test("findUpdatesAvailable ignores detached references", () => {
  const draft = makeDraft();
  draft.references = [{
    instanceId: "act-1",
    libraryType: "activity",
    libraryItemId: "lib-001",
    libraryVersion: "1.0.0",
    state: "detached",
    overrides: {},
  }];

  const versions = new Map([["activity:lib-001", "2.0.0"]]);
  assert.equal(findUpdatesAvailable(draft, versions).length, 0);
});

test("acceptUpdate resets to inherited with new version", () => {
  let draft = makeDraft();
  draft.references = [{
    instanceId: "act-1",
    libraryType: "activity",
    libraryItemId: "lib-001",
    libraryVersion: "1.0.0",
    state: "overridden",
    overrides: { title: "old" },
  }];

  draft = acceptUpdate(draft, "act-1", "1.3.0");
  assert.equal(draft.references[0].libraryVersion, "1.3.0");
  assert.equal(draft.references[0].state, "inherited");
  assert.deepEqual(draft.references[0].overrides, {});
});

// ─── Difference Viewer ───────────────────────────────────────────────────────

test("compareActivities detects added, removed, and changed blocks", () => {
  const current = makeActivity("a", "Test");
  current.blocks = [
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b1", version: "1.0.0", type: "paragraph", metadata: {}, relationships: {}, content: { text: "Hello" } },
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b2", version: "1.0.0", type: "paragraph", metadata: {}, relationships: {}, content: { text: "World" } },
  ];

  const updated = makeActivity("a", "Test Updated");
  updated.blocks = [
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b1", version: "1.0.0", type: "paragraph", metadata: {}, relationships: {}, content: { text: "Hello changed" } },
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b3", version: "1.0.0", type: "heading", metadata: {}, relationships: {}, content: { text: "New", level: 2 } },
  ];

  const diff = compareActivities(current, updated);
  assert.equal(diff.addedBlocks.length, 1);
  assert.equal(diff.addedBlocks[0].id, "b3");
  assert.equal(diff.removedBlocks.length, 1);
  assert.equal(diff.removedBlocks[0].id, "b2");
  assert.ok(diff.changedBlocks.length > 0);
  assert.ok(diff.metadataChanges.some((c) => c.field === "title"));
});

// ─── Coverage Analysis ───────────────────────────────────────────────────────

test("analyseCoverage identifies missing and covered outcomes", () => {
  const pkg = emptyPackage("h", "H", "c");
  const a1 = makeActivity("a1", "A1");
  a1.relationships.learningOutcomes = ["LO1", "LO2"];
  const a2 = makeActivity("a2", "A2");
  a2.relationships.learningOutcomes = ["LO1"];
  pkg.activities.push(a1, a2);

  const result = analyseCoverage(pkg, ["LO1", "LO2", "LO3"]);
  assert.equal(result.missing.length, 1);
  assert.ok(result.missing.includes("LO3"));
  assert.equal(result.learningOutcomes.find((lo) => lo.id === "LO1")!.activityCount, 2);
});

// ─── Difficulty Balance ──────────────────────────────────────────────────────

test("analyseDifficultyBalance counts correctly", () => {
  const pkg = emptyPackage("h", "H", "c");
  pkg.activities.push(
    makeActivity("a1", "A1", "foundation"),
    makeActivity("a2", "A2", "standard"),
    makeActivity("a3", "A3", "challenge"),
    makeActivity("a4", "A4", "standard"),
  );

  const balance = analyseDifficultyBalance(pkg);
  assert.equal(balance.foundation, 1);
  assert.equal(balance.standard, 2);
  assert.equal(balance.challenge, 1);
  assert.equal(balance.total, 4);
});

// ─── Session Statistics ──────────────────────────────────────────────────────

test("computeSessionStats counts activities and questions", () => {
  const pkg = emptyPackage("h", "H", "c");
  const activity = makeActivity("a1", "A1");
  activity.metadata.estimatedDurationMinutes = 25;
  activity.blocks = [
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b1", version: "1.0.0", type: "single-choice", metadata: {}, relationships: {}, content: { questionId: "q1" } },
    { schema: "lp.content.block", schemaVersion: "0.1.0", id: "b2", version: "1.0.0", type: "reference", metadata: {}, relationships: {}, content: { title: "R1" } },
  ];
  pkg.activities.push(activity);
  const session = createSession({ id: "s1", title: "S1", kind: "lesson", activities: ["a1"] });
  pkg.sessions.push(session);

  const stats = computeSessionStats(pkg, "s1");
  assert.equal(stats.activityCount, 1);
  assert.equal(stats.questionCount, 1);
  assert.equal(stats.resourceCount, 1);
  assert.equal(stats.estimatedDuration, 25);
});

test("computeSessionStats uses override duration when present", () => {
  const pkg = emptyPackage("h", "H", "c");
  const activity = makeActivity("a1", "A1");
  activity.metadata.estimatedDurationMinutes = 20;
  pkg.activities.push(activity);
  pkg.sessions.push(createSession({ id: "s1", title: "S1", kind: "lesson", activities: ["a1"] }));

  const stats = computeSessionStats(pkg, "s1", [{
    instanceId: "a1",
    libraryType: "activity",
    libraryItemId: "lib-1",
    libraryVersion: "1.0.0",
    state: "overridden",
    overrides: { estimatedDurationMinutes: 30 },
  }]);
  assert.equal(stats.estimatedDuration, 30);
  assert.equal(stats.knownDurationMinutes, 30);
});

test("computeSessionStats reports mixed known and unknown duration honestly", () => {
  const pkg = emptyPackage("h", "H", "c");
  const known = makeActivity("a1", "Known");
  known.metadata.estimatedDurationMinutes = 15;
  const unknown = makeActivity("a2", "Unknown");
  pkg.activities.push(known, unknown);
  pkg.sessions.push(createSession({ id: "s1", title: "S1", kind: "lesson", activities: ["a1", "a2"] }));

  const stats = computeSessionStats(pkg, "s1");
  assert.equal(stats.estimatedDuration, null);
  assert.equal(stats.knownDurationMinutes, 15);
  assert.equal(stats.unknownDurationActivityCount, 1);
});

test("duration helpers resolve inherited and overridden values", () => {
  const activity = makeActivity("a1", "A1");
  activity.metadata.estimatedDurationMinutes = 20;
  const reference = {
    instanceId: "a1",
    libraryType: "activity" as const,
    libraryItemId: "lib-1",
    libraryVersion: "1.0.0",
    state: "overridden" as const,
    overrides: { estimatedDurationMinutes: 35 },
  };
  assert.equal(resolveActivityEstimatedDuration(activity, reference), 35);
  assert.deepEqual(durationOverrideState(activity, reference), {
    inherited: 20,
    resolved: 35,
    overridden: true,
  });
});

test("validateEstimatedDurationMinutes rejects invalid values", () => {
  assert.equal(validateEstimatedDurationMinutes(-1), "Duration must be a whole number between 1 and 480 minutes.");
  assert.equal(validateEstimatedDurationMinutes(30), null);
});

// ─── Composition Templates ───────────────────────────────────────────────────

test("applyCompositionTemplate creates week with sessions and activities", () => {
  let draft = makeDraft();
  draft = applyCompositionTemplate(draft, "weekly-lesson", 1);

  assert.equal(draft.package.weeks.length, 1);
  assert.ok(draft.package.sessions.length >= 1);
  assert.ok(draft.package.activities.length >= 3);
  assert.equal(draft.package.activities[0].metadata.estimatedDurationMinutes, 10);
});

test("all built-in templates are valid", () => {
  for (const key of Object.keys(BUILT_IN_TEMPLATES)) {
    let draft = makeDraft();
    draft = applyCompositionTemplate(draft, key, 1);
    assert.ok(draft.package.weeks.length > 0, `Template ${key} creates a week`);
  }
});

// ─── Recipes ─────────────────────────────────────────────────────────────────

test("applyRecipe creates session with activity slots", () => {
  let draft = makeDraft();
  const week = createWeek({ id: "w1", teachingWeek: 1, title: "Week 1" });
  draft.package.weeks.push(week);

  draft = applyRecipe(draft, "w1", "revision-session");
  assert.ok(draft.package.sessions.length >= 1);
  assert.ok(draft.package.activities.length >= 4);
  assert.equal(draft.package.activities[0].metadata.estimatedDurationMinutes, 10);
});

test("custom template can be used in composition", () => {
  let draft = makeDraft();
  draft = applyCustomCompositionTemplate(draft, {
    weekTitle: "Custom Week",
    sessions: [{
      title: "Workshop",
      kind: "practical",
      activitySlots: [{ type: "build", label: "Build Task", estimatedDurationMinutes: 45 }],
    }],
  }, 1);
  assert.equal(draft.package.weeks.length, 1);
  assert.equal(draft.package.activities[0].metadata.estimatedDurationMinutes, 45);
});

test("custom recipe can be used in composition", () => {
  let draft = makeDraft();
  draft.package.weeks.push(createWeek({ id: "w1", teachingWeek: 1, title: "Week 1" }));
  draft = applyCustomRecipe(draft, "w1", {
    title: "Custom Session",
    kind: "lesson",
    slots: [{ type: "starter", label: "Starter", estimatedDurationMinutes: 12 }],
  });
  assert.equal(draft.package.sessions.length, 1);
  assert.equal(draft.package.activities[0].metadata.estimatedDurationMinutes, 12);
});

test("custom template and recipe records parse from rpc rows", () => {
  const template = parseCustomTemplateRecord({
    id: "t1",
    stable_key: "custom-template",
    title: "Custom Template",
    template_type: "custom",
    specification: { weekTitle: "Week", sessions: [] },
    tags: ["one"],
    status: "draft",
    version: "1.0.0",
    author: "Author",
    created_at: "2026-08-18T08:00:00Z",
    updated_at: "2026-08-18T08:00:00Z",
  });
  const recipe = parseCustomRecipeRecord({
    id: "r1",
    stable_key: "custom-recipe",
    title: "Custom Recipe",
    recipe_type: "custom",
    specification: { title: "Recipe", kind: "lesson", slots: [] },
    tags: ["one"],
    status: "draft",
    version: "1.0.0",
    author: "Author",
    created_at: "2026-08-18T08:00:00Z",
    updated_at: "2026-08-18T08:00:00Z",
  });
  assert.equal(template.title, "Custom Template");
  assert.equal(recipe.title, "Custom Recipe");
});

test("all built-in recipes are valid", () => {
  for (const key of Object.keys(BUILT_IN_RECIPES)) {
    let draft = makeDraft();
    const week = createWeek({ id: "w1", teachingWeek: 1, title: "Week 1" });
    draft.package.weeks.push(week);
    draft = applyRecipe(draft, "w1", key);
    assert.ok(draft.package.sessions.length > 0, `Recipe ${key} creates a session`);
  }
});

// ─── Version Graph ───────────────────────────────────────────────────────────

test("buildVersionGraph creates lineage", () => {
  const versions = [
    { version: "1.0.0" },
    { version: "1.1.0" },
    { version: "1.2.0", familyId: "prog-diag", difficulty: "challenge" },
  ];
  const graph = buildVersionGraph(versions);
  assert.equal(graph.length, 3);
  assert.equal(graph[0].parentVersion, undefined);
  assert.equal(graph[1].parentVersion, "1.0.0");
  assert.equal(graph[2].isVariant, true);
});
