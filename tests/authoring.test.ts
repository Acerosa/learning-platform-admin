import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import { createDraft, deleteDraft, duplicateDraft, importToPackage, loadDrafts, mergePackages, packageContentsSummary, saveDraft } from "../src/content/draft-store.ts";
import { exportActivityPackage, exportDocument, exportPackage } from "../src/content/export.ts";
import { applyWorkbookExtensions, parseJsonImport, sheetsFromWorkbook } from "../src/content/import-files.ts";
import { createActivity, createBlock, createSession, createWeek, duplicateBlock, emptyPackage, nextStableId, syncCurriculumLists } from "../src/content/factories.ts";
import type { ContentBlock } from "../src/content/types.ts";
import { containsUnsafeMarkup, sanitizeImportedText, sanitizeObject } from "../src/content/sanitize.ts";
import { previewActivityHtml, previewWeekHtml, validateDocument, validatePackage } from "../src/content/validate.ts";
import { getContentEngine } from "../src/content/engine.ts";
import { canPostWeek, canRemoveWeek, postWeek, removeWeek, WEEK_VISIBILITY_PUBLISH_REMINDER } from "../src/content/week-availability.ts";

test("week session and activity factories emit canonical envelopes", () => {
  const week = createWeek({ id: "week-20", teachingWeek: 20, title: "Synthetic week", learningOutcomes: [] });
  const session = createSession({ id: "week-20-workshop", title: "Workshop", kind: "independent-study", weekId: "week-20" });
  const activity = createActivity({ id: "admin-test-activity", title: "Test activity" });
  assert.equal(week.schema, "lp.content.week");
  assert.equal(week.schemaVersion, week.version);
  assert.equal(session.metadata.kind, "independent-study");
  assert.equal(activity.schema, "lp.content.activity");
  assert.equal(validateDocument(week, "lp.content.week").length, 0);
  assert.equal(validateDocument(session, "lp.content.session").length, 0);
  assert.equal(validateDocument(activity, "lp.content.activity").length, 0);
});

test("block composer adds removes reorders and keeps stable ids", () => {
  const activity = createActivity({ id: "stable-activity", title: "Stable" });
  const first = createBlock(activity.id, "paragraph", []);
  const second = createBlock(activity.id, "single-choice", [first.id]);
  assert.notEqual(first.id, second.id);
  assert.equal(second.content.questionId, `${second.id}-q`);
  const edited: ContentBlock = { ...second, content: { ...second.content, prompt: "Edited prompt" } };
  assert.equal(edited.id, second.id);
  assert.equal(edited.content.questionId, second.content.questionId);
  const copy = duplicateBlock(edited, activity.id, [first.id, second.id]);
  assert.notEqual(copy.id, edited.id);
  const reordered = [copy, first, second];
  assert.deepEqual(reordered.map((block) => block.id), [copy.id, first.id, second.id]);
  const remaining = reordered.filter((block) => block.id !== first.id);
  assert.equal(remaining.length, 2);
});

test("nextStableId never reuses an existing id", () => {
  assert.equal(nextStableId("block", ["block-1", "block-2"]), "block-3");
});

test("unimplemented block types cannot be authored", () => {
  assert.throws(() => createBlock("activity-1", "multiple-choice", []), /Unsupported block type/);
});

test("unsupported schema versions are rejected by the canonical validator", () => {
  const issues = validateDocument({
    schema: "lp.content.activity",
    schemaVersion: "9.9.9",
    id: "x",
    version: "9.9.9",
    metadata: { title: "X", status: "planned" },
    relationships: {},
    blocks: [],
  }, "lp.content.activity");
  assert.ok(issues.some((issue) => issue.code === "UNSUPPORTED_VERSION"));
});

test("validation diagnostics include duplicate id missing reference and cycles", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const week = createWeek({ id: "week-20", teachingWeek: 20, title: "Missing LO", learningOutcomes: ["LO-MISSING"] });
  pkg.weeks.push(week, week);
  const first = createActivity({ id: "act-a", title: "A" });
  const second = createActivity({ id: "act-b", title: "B" });
  first.relationships.prerequisites = ["act-b"];
  second.relationships.prerequisites = ["act-a"];
  pkg.activities.push(first, second);
  const result = validatePackage(syncCurriculumLists(pkg));
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "DUPLICATE_ID"));
  assert.ok(result.issues.some((issue) => issue.code === "MISSING_REFERENCE"));
  assert.ok(result.issues.some((issue) => issue.code === "CYCLIC_REFERENCE"));
  result.issues.forEach((issue) => {
    assert.ok(issue.code);
    assert.ok(issue.path);
    assert.ok(issue.message);
  });
});

test("unsafe imported markup is rejected", () => {
  assert.equal(containsUnsafeMarkup('<script>alert(1)</script>'), true);
  assert.throws(() => sanitizeImportedText('<img src=x onerror=alert(1)>'), /disallowed HTML/);
  assert.throws(() => sanitizeObject({ text: "javascript:alert(1)" }), /disallowed HTML/);
});

test("json object import validates through the canonical package validator", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const activity = createActivity({ id: "admin-roundtrip", title: "Round trip" });
  activity.blocks = [createBlock(activity.id, "heading", [])];
  const incoming = importToPackage(JSON.parse(exportDocument(activity)), pkg.hub, pkg.curriculum);
  const merged = mergePackages(pkg, incoming);
  const result = validatePackage(merged);
  assert.equal(result.valid, true, result.issues.map((issue) => `${issue.code} ${issue.path}`).join("\n"));
  assert.equal(merged.activities[0].id, "admin-roundtrip");
});

test("malformed json import is rejected", () => {
  assert.throws(() => parseJsonImport("{not json"), /JSON/);
});

test("excel option extensions attach without renaming block ids", () => {
  const engine = getContentEngine();
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const imported = engine.importFromSheets({
    hub: pkg.hub,
    curriculum: pkg.curriculum,
    Activities: [{ id: "excel-activity", title: "Excel", status: "available", summary: "" }],
    Blocks: [{ activityId: "excel-activity", id: "excel-q", type: "single-choice", prompt: "Q?" }],
  });
  const extended = applyWorkbookExtensions(imported, {
    Options: [
      { blockId: "excel-q", optionId: "a", label: "Yes", correct: "true" },
      { blockId: "excel-q", optionId: "b", label: "No", correct: "false" },
    ],
    Feedback: [{ blockId: "excel-q", correct: "Yes", incorrect: "No" }],
  });
  const block = extended.activities[0].blocks[0];
  assert.equal(block.id, "excel-q");
  assert.equal((block.content.options as { id: string }[])[0].id, "a");
  assert.equal(block.content.correctOptionId, "a");
});

test("controlled excel workbook parses through the shared sheet contract", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ id: "excel-activity", title: "Excel activity", status: "available", summary: "" }]), "Activities");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ activityId: "excel-activity", id: "excel-h", type: "heading", text: "From Excel" }]), "Blocks");
  const sheets = sheetsFromWorkbook(workbook, XLSX.utils);
  const engine = getContentEngine();
  const imported = applyWorkbookExtensions(engine.importFromSheets({
    ...sheets,
    hub: pkg.hub,
    curriculum: pkg.curriculum,
  }), sheets);
  assert.equal(imported.activities[0].id, "excel-activity");
  assert.equal(imported.activities[0].blocks[0].id, "excel-h");
});

test("preview uses the canonical learner renderer", () => {
  const activity = createActivity({ id: "preview-activity", title: "Preview activity" });
  const heading = createBlock(activity.id, "heading", []);
  heading.content = { ...heading.content, text: "Preview heading" };
  activity.blocks = [heading];
  const html = previewActivityHtml(activity);
  assert.match(html, /Preview activity/);
  assert.match(html, /Preview heading/);
  assert.doesNotMatch(html, /<script/i);
});

test("draft save restore duplicate and delete keep local package state", () => {
  const store: Record<string, string> = {};
  const scope = globalThis as { window?: { localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } } };
  const previous = scope.window;
  scope.window = {
    localStorage: {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => { store[key] = value; },
      removeItem: (key) => { delete store[key]; },
    },
  };
  try {
    const draft = createDraft("authoring-hub", "Authoring hub", "ocr-level-3-it");
    const saved = saveDraft([], draft);
    assert.equal(saved.length, 1);
    assert.equal(loadDrafts()[0].id, draft.id);
    const copy = duplicateDraft(draft);
    assert.notEqual(copy.id, draft.id);
    assert.equal(copy.status, "draft");
    const withCopy = saveDraft(saved, copy);
    const remaining = deleteDraft(withCopy, draft.id);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, copy.id);
    assert.equal(loadDrafts().length, 1);
  } finally {
    scope.window = previous;
  }
});

test("export emits canonical json accepted by the local validator", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const activity = createActivity({ id: "export-activity", title: "Export activity" });
  activity.blocks = [createBlock(activity.id, "paragraph", [])];
  pkg.activities.push(activity);
  const exported = JSON.parse(exportActivityPackage(pkg, activity.id));
  assert.equal(validatePackage(exported).valid, true);
  assert.equal(JSON.parse(exportPackage(pkg)).activities[0].id, "export-activity");
  assert.equal(JSON.parse(exportDocument(activity)).schema, "lp.content.activity");
});

test("session kinds come from the schema contract", () => {
  const engine = getContentEngine();
  assert.deepEqual([...engine.SESSION_KINDS], ["session", "independent-study", "homework", "revision", "retrieval"]);
});

test("complete week graph imports merge validates and previews", () => {
  const base = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const existingWeek = createWeek({ id: "week-1", teachingWeek: 1, title: "Existing week", learningOutcomes: ["LO1"], sessions: ["week-1-session-1"] });
  const existingSession = createSession({ id: "week-1-session-1", title: "Session 1", kind: "session", weekId: "week-1", activities: ["week-1-keep"] });
  const existingActivity = createActivity({ id: "week-1-keep", title: "Keep me", learningOutcomes: ["LO1"], assignment: "A1" });
  existingActivity.blocks = [createBlock(existingActivity.id, "paragraph", [])];
  const seeded = syncCurriculumLists({
    ...base,
    weeks: [existingWeek],
    sessions: [existingSession],
    activities: [existingActivity],
  });

  const week = createWeek({
    id: "week-2",
    teachingWeek: 2,
    title: "Imported week",
    status: "available",
    learningOutcomes: ["LO1"],
    assignment: "A1",
    sessions: ["week-2-session-1", "week-2-session-2", "week-2-independent-study"],
  });
  week.relationships.curriculum = "u14-curriculum";
  const session1 = createSession({
    id: "week-2-session-1",
    title: "Session 1",
    kind: "session",
    weekId: "week-2",
    activities: ["week-2-activity-a"],
    sortOrder: 1,
    defaultOpen: true,
  });
  const session2 = createSession({
    id: "week-2-session-2",
    title: "Session 2",
    kind: "session",
    weekId: "week-2",
    activities: ["week-2-activity-b"],
    sortOrder: 2,
  });
  const independent = createSession({
    id: "week-2-independent-study",
    title: "Directed independent study",
    kind: "independent-study",
    weekId: "week-2",
    activities: ["week-2-activity-c"],
    sortOrder: 3,
  });
  const activityA = createActivity({ id: "week-2-activity-a", title: "Activity A", status: "available", learningOutcomes: ["LO1"], assignment: "A1" });
  activityA.blocks = [createBlock(activityA.id, "heading", [])];
  const activityB = createActivity({ id: "week-2-activity-b", title: "Activity B", status: "available", learningOutcomes: ["LO1"], assignment: "A1" });
  activityB.blocks = [createBlock(activityB.id, "paragraph", [])];
  const activityC = createActivity({ id: "week-2-activity-c", title: "Activity C", status: "available", learningOutcomes: ["LO1"], assignment: "A1" });
  activityC.blocks = [createBlock(activityC.id, "reflection", [])];

  const incoming = importToPackage({
    schema: "lp.content.package",
    schemaVersion: "0.1.0",
    weeks: [week],
    sessions: [session1, session2, independent],
    activities: [activityA, activityB, activityC],
  }, seeded.hub, seeded.curriculum);
  const summary = packageContentsSummary(incoming);
  assert.deepEqual(summary.weeks, ["week-2"]);
  assert.equal(summary.sessions.length, 3);
  assert.equal(summary.activities.length, 3);
  assert.equal(incoming.weeks[0].relationships.curriculum, seeded.curriculum.id);
  assert.equal(incoming.learningOutcomes.some((item) => item.id === "LO1"), true);
  assert.equal(incoming.assignments.some((item) => item.id === "A1"), true);

  const merged = mergePackages(seeded, incoming);
  const result = validatePackage(merged);
  assert.equal(result.valid, true, result.issues.map((issue) => `${issue.code} ${issue.path}`).join("\n"));
  assert.equal(merged.activities.some((item) => item.id === "week-1-keep"), true);
  const importedWeek = merged.weeks.find((item) => item.id === "week-2");
  const importedSessions = importedWeek?.relationships.sessions;
  assert.ok(Array.isArray(importedSessions));
  assert.equal(importedSessions.length, 3);
  assert.equal(merged.sessions.find((item) => item.id === "week-2-session-1")?.relationships.week, "week-2");
  assert.equal(merged.sessions.find((item) => item.id === "week-2-independent-study")?.metadata.kind, "independent-study");

  const html = previewWeekHtml(merged, "week-2");
  assert.match(html, /data-lp-week="week-2"/);
  assert.match(html, /Session 1/);
  assert.match(html, /Directed independent study/);
  assert.match(html, /Activity A/);
  assert.doesNotMatch(html, /<script/i);
});

test("post week and remove week update package week status without deleting content", () => {
  const pkg = emptyPackage("authoring-hub", "Authoring hub", "ocr-level-3-it");
  const week = createWeek({
    id: "week-7",
    teachingWeek: 7,
    title: "Visibility week",
    status: "planned",
    learningOutcomes: ["LO1"],
    sessions: ["week-7-session"],
  });
  const session = createSession({
    id: "week-7-session",
    title: "Session",
    kind: "session",
    weekId: "week-7",
    activities: ["week-7-activity"],
  });
  const activity = createActivity({ id: "week-7-activity", title: "Activity", status: "available" });
  pkg.weeks.push(week);
  pkg.sessions.push(session);
  pkg.activities.push(activity);

  const posted = postWeek(pkg, "week-7");
  assert.equal(posted.weeks.length, 1);
  assert.equal(posted.weeks[0].metadata.status, "available");
  assert.equal(posted.sessions.length, 1);
  assert.equal(posted.activities.length, 1);
  assert.deepEqual(posted.weeks[0].relationships.sessions, ["week-7-session"]);
  assert.equal(canPostWeek(posted.weeks[0]), false);
  assert.equal(canRemoveWeek(posted.weeks[0]), true);

  const removed = removeWeek(posted, "week-7");
  assert.equal(removed.weeks.length, 1);
  assert.equal(removed.weeks[0].id, "week-7");
  assert.equal(removed.weeks[0].metadata.status, "planned");
  assert.equal(removed.sessions.some((item) => item.id === "week-7-session"), true);
  assert.equal(removed.activities.some((item) => item.id === "week-7-activity"), true);
  assert.equal(canPostWeek(removed.weeks[0]), true);
  assert.equal(canRemoveWeek(removed.weeks[0]), false);
  assert.equal(WEEK_VISIBILITY_PUBLISH_REMINDER, "Publish to Platform for learners to see this.");
  assert.deepEqual([...getContentEngine().STATUSES], ["planned", "available", "archived"]);
});
