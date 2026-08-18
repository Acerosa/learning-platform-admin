import assert from "node:assert/strict";
import test from "node:test";
import {
  applySuccessfulSave,
  beginExclusiveAction,
  confirmationForPublication,
  createSequenceGate,
  DRAFT_AUTOSAVE_MS,
  isStaleResult,
  keepLocalOnSaveFailure,
} from "../src/content/async-authoring.ts";
import {
  activityFamilyId,
  duplicateActivityAsVariant,
  duplicateIndependentActivity,
  insertActivityVariant,
} from "../src/content/activity-variants.ts";
import { createActivity, createBlock, createSession, createWeek, emptyPackage, syncCurriculumLists } from "../src/content/factories.ts";
import { createWorkingCopy, createWorkingCopyFromPackage, publishVersion, startReview, submitForReview, approveRecord } from "../src/content/versioning.ts";
import { createDraft } from "../src/content/draft-store.ts";
import { validatePackage } from "../src/content/validate.ts";

test("debounced autosave interval is 500-1000ms", () => {
  assert.ok(DRAFT_AUTOSAVE_MS >= 500 && DRAFT_AUTOSAVE_MS <= 1000);
});

test("latest edit wins when save responses return out of order", () => {
  const gate = createSequenceGate();
  const first = gate.next();
  const second = gate.next();
  assert.equal(isStaleResult(first, gate.current()), true);
  assert.equal(gate.isCurrent(second), true);
  const local = { revision: 1, title: "B" };
  assert.equal(applySuccessfulSave(local, { revision: 2 }, first, second), null);
  assert.deepEqual(applySuccessfulSave(local, { revision: 3 }, second, second), { revision: 3, title: "B" });
});

test("failed autosave preserves current editor content", () => {
  const current = { title: "unsaved local", revision: 1 };
  assert.equal(keepLocalOnSaveFailure(current, 1, 2), current);
});

test("duplicate Publish clicks are rejected while a request is in progress", () => {
  assert.equal(beginExclusiveAction(true).accepted, false);
  assert.equal(beginExclusiveAction(false).accepted, true);
  assert.deepEqual(confirmationForPublication("publishing"), {
    showPublished: false,
    showPublishing: true,
    disablePublish: true,
  });
  assert.equal(confirmationForPublication("failed").showPublished, false);
});

test("stale validation results are ignored by sequence comparison", () => {
  assert.equal(isStaleResult(4, 5), true);
  assert.equal(isStaleResult(5, 5), false);
});

test("duplicate and difficulty variants get new ids and do not copy evidence", () => {
  const source = createActivity({ id: "loops-practice", title: "Loops" });
  source.blocks = [createBlock(source.id, "single-choice", [])];
  const challenge = duplicateActivityAsVariant(source, "challenge", [source.id]);
  const foundation = duplicateActivityAsVariant(source, "foundation", [source.id, challenge.id]);
  assert.equal(challenge.id, "loops-practice-challenge");
  assert.equal(foundation.id, "loops-practice-foundation");
  assert.equal(challenge.metadata.difficulty, "challenge");
  assert.equal(activityFamilyId(challenge), "loops-practice");
  assert.notEqual(challenge.blocks[0].id, source.blocks[0].id);
  assert.notEqual(challenge.blocks[0].content.questionId, source.blocks[0].content.questionId);
  assert.equal(source.blocks[0].id, "loops-practice-block-1");
});

test("package variant insert attaches the new activity to the same session", () => {
  let pkg = emptyPackage("hub-a", "Hub A", "course-a");
  const week = createWeek({ id: "week-1", teachingWeek: 1, title: "Week 1" });
  const session = createSession({ id: "week-1-workshop", title: "Workshop", kind: "session", weekId: "week-1", activities: ["loops-practice"] });
  const activity = createActivity({ id: "loops-practice", title: "Loops" });
  pkg = syncCurriculumLists({ ...pkg, weeks: [week], sessions: [session], activities: [activity] });
  pkg = insertActivityVariant(pkg, "loops-practice", "challenge");
  pkg = duplicateIndependentActivity(pkg, "loops-practice");
  assert.equal(pkg.activities.length, 3);
  const sessionActivities = pkg.sessions[0].relationships.activities as string[];
  assert.ok(sessionActivities.includes("loops-practice-challenge"));
  assert.equal(validatePackage(pkg).valid, true);
});

test("editing published content creates a draft working copy", () => {
  let draft = createDraft("hub-a", "Hub A", "course-a");
  draft.package.activities = [createActivity({ id: "loops-practice", title: "Loops" })];
  const ready = submitForReview(draft);
  const reviewing = startReview(ready, "Riley");
  const approved = approveRecord(reviewing, "ok");
  const [published] = publishVersion([], approved, { version: "1.0.0", publishedBy: "Riley" });
  const working = createWorkingCopy(published, "Ada");
  assert.equal(working.status, "draft");
  assert.equal(working.basedOnVersion, "1.0.0");
  assert.equal(published.status, "published");
  const fromLive = createWorkingCopyFromPackage(published.package, "Ada", "1.0.0");
  assert.equal(fromLive.status, "draft");
  assert.equal(fromLive.basedOnVersion, "1.0.0");
});
