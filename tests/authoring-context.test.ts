import assert from "node:assert/strict";
import test from "node:test";
import {
  findAuthoringRecordForContext,
  pruneRecordsForLocalStorage,
  recordsForContext,
  resolveActiveDraftForContext,
} from "../src/content/authoring-context.ts";
import { createWeek } from "../src/content/factories.ts";
import { createDraft } from "../src/content/draft-store.ts";

test("resolveActiveDraftForContext ignores drafts from another hub", () => {
  const l2e = createDraft("l2-emerging-tech", "L2 Emerging Tech", "l2-emerging-tech", "Ada");
  l2e.package.weeks = [createWeek({ id: "week-iot", teachingWeek: 1, title: "Internet of Things" })];
  const unit3 = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  unit3.package.weeks = [createWeek({ id: "week-1", teachingWeek: 1, title: "Introduction to Cyber Security" })];

  const active = resolveActiveDraftForContext([l2e, unit3], "unit-3-cyber-security", "ocr-level-3-it", "Unit 3", "Ada");
  assert.equal(active.hubId, "unit-3-cyber-security");
  assert.equal(active.courseKey, "ocr-level-3-it");
  assert.equal(active.package.weeks[0]?.metadata.title, "Introduction to Cyber Security");
});

test("findAuthoringRecordForContext prefers the editable draft for the selected context", () => {
  const published = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  published.status = "approved";
  const editable = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  editable.updatedAt = "2026-08-28T18:00:00.000Z";

  const match = findAuthoringRecordForContext([published, editable], "unit-3-cyber-security", "ocr-level-3-it");
  assert.equal(match?.id, editable.id);
  assert.equal(match?.status, "draft");
});

test("pruneRecordsForLocalStorage keeps one recoverable record per hub/course and drops immutable history", () => {
  const unit3Draft = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  const l2eDraft = createDraft("l2-emerging-tech", "L2 Emerging Tech", "l2-emerging-tech", "Ada");
  const published = {
    ...createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada"),
    status: "published" as const,
    version: "0.1.0",
  };

  const pruned = pruneRecordsForLocalStorage([unit3Draft, l2eDraft, published]);
  assert.equal(pruned.length, 2);
  assert.deepEqual(
    pruned.map((item) => `${item.hubId}:${item.courseKey}`).sort(),
    ["l2-emerging-tech:l2-emerging-tech", "unit-3-cyber-security:ocr-level-3-it"],
  );
  assert.ok(pruned.every((item) => item.status !== "published"));
});

test("recordsForContext isolates hub/course pairs", () => {
  const unit3 = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada");
  const l2e = createDraft("l2-emerging-tech", "L2 Emerging Tech", "l2-emerging-tech", "Ada");
  const scoped = recordsForContext([unit3, l2e], "unit-3-cyber-security", "ocr-level-3-it");
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.hubId, "unit-3-cyber-security");
});
