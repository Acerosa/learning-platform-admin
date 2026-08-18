import assert from "node:assert/strict";
import test from "node:test";
import { createWeek, emptyPackage } from "../src/content/factories.ts";
import { authoringDraftFromRemote, createDraft, mergeRemoteAuthoringDrafts } from "../src/content/versioning.ts";

test("authoringDraftFromRemote preserves hosted id and revision", () => {
  const pkg = emptyPackage("unit-3-cyber-security", "Unit 3", "ocr-level-3-it");
  pkg.weeks = [createWeek({ id: "week-1", teachingWeek: 1, title: "Intro" })];
  const remote = authoringDraftFromRemote({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Hosted draft",
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    lifecycleStatus: "draft",
    revision: 4,
    package: pkg,
    basedOnPackageVersion: "1.2.0",
    updatedAt: "2026-08-18T10:00:00.000Z",
  }, "Ada Author");
  assert.equal(remote.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(remote.remoteRevision, 4);
  assert.equal(remote.status, "draft");
  assert.equal(remote.basedOnVersion, "1.2.0");
  assert.equal(remote.package.weeks[0].id, "week-1");
});

test("mergeRemoteAuthoringDrafts treats hosted drafts as authoritative for matching ids", () => {
  const local = createDraft("unit-3-cyber-security", "Unit 3", "ocr-level-3-it", "Ada Author");
  const remote = authoringDraftFromRemote({
    id: local.id,
    title: "Hosted title",
    hubCode: "unit-3-cyber-security",
    courseKey: "ocr-level-3-it",
    lifecycleStatus: "ready-for-review",
    revision: 2,
    package: emptyPackage("unit-3-cyber-security", "Unit 3", "ocr-level-3-it"),
    basedOnPackageVersion: "1.0.0",
    updatedAt: "2026-08-18T11:00:00.000Z",
  }, "Ada Author");
  const extraRemote = authoringDraftFromRemote({
    id: "22222222-2222-4222-8222-222222222222",
    title: "Second hosted draft",
    hubCode: "unit-14-software-engineering-for-business",
    courseKey: "tlevel-digital",
    lifecycleStatus: "draft",
    revision: 1,
    package: emptyPackage("unit-14-software-engineering-for-business", "Unit 14", "tlevel-digital"),
    basedOnPackageVersion: null,
    updatedAt: "2026-08-18T11:30:00.000Z",
  }, "Ada Author");
  const merged = mergeRemoteAuthoringDrafts([local], [remote, extraRemote]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, "Hosted title");
  assert.equal(merged[0].remoteRevision, 2);
  assert.equal(merged[0].status, "ready-for-review");
  assert.equal(merged[1].id, extraRemote.id);
});
